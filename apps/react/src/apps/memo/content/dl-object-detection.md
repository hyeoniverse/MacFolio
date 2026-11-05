---
title: 물체 검출의 성능 평가와 RCNN·YOLO
date: 2023-09-25
category: CS/딥러닝
series: 딥러닝 및 응용
seriesOrder: 2
summary: 인식의 세부 문제와 데이터셋, CAM·Grad-CAM으로 분류 근거를 설명하는 방법, IoU·AP·mAP로 검출 성능을 평가하는 절차, 두 단계 방법론 RCNN·Fast RCNN과 한 단계 방법론 YOLO의 구조를 정리했다.
---

## 들어가기 전에

분류 모델은 영상 한 장에 "치와와" 같은 답 하나를 낸다. 자율주행차의 카메라 영상에는 보행자, 자동차, 신호등이 동시에 있고, 차가 알아야 하는 것은 보행자가 있다는 사실이 아니라 보행자가 화면의 어느 위치에 몇 명 있는지다. ==검출은 영상에 있는 물체마다 위치를 나타내는 바운딩 박스와 부류 확률을 함께 출력하는 문제다.== 물체가 몇 개 있는지 미리 알 수 없으므로 출력 개수도 영상마다 달라진다.

분류기를 그대로 쓰는 가장 단순한 방법은 여러 크기의 윈도우를 영상 전체에 옮기며 윈도우마다 분류하는 것이다. 위치와 크기의 조합이 수만 개가 되어 느리고, 겹친 윈도우마다 같은 물체를 여러 번 찾는다. 채점도 분류보다 복잡하다. 예측 박스가 참값 박스와 얼마나 겹쳐야 맞힌 것으로 볼지, 신뢰도 임계값에 따라 달라지는 정밀도와 재현율을 어떻게 하나의 수로 합칠지 정해야 한다.

이 글이 답하려는 질문은 두 가지다. 검출 결과는 어떤 절차로 채점하는가. 그리고 후보 영역을 먼저 만드는 두 단계 방법과 위치와 부류를 한 번에 회귀하는 한 단계 방법은 속도와 정확률을 어떻게 맞바꾸는가. 검출에 앞서 분류 모델이 영상의 어디를 보고 판단했는지 설명하는 CAM과 Grad-CAM도 함께 다룬다.

| 순서 | 내용                                                            |
| ---- | --------------------------------------------------------------- |
| 1    | 인식의 세부 문제(분류, 검출, 분할), 데이터셋과 대회             |
| 2    | 분류의 설명 가능성: CAM, Grad-CAM, 적대적 공격                  |
| 3    | 검출 성능 평가: IoU, AP 계산 알고리즘, 정밀도-재현율 곡선과 mAP |
| 4    | 두 단계 방법론: RCNN, Fast RCNN                                 |
| 5    | 한 단계 방법론: YOLO, YOLO v3로 물체 검출하기                   |

컨볼루션과 풀링, 전역 평균 풀링, 사전 학습 모델을 백본으로 쓰는 방법은 [컨볼루션 신경망의 구조와 전이 학습](/memo/dl-cnn-transfer-learning)에서 다뤘다. 분류기와 검출기의 백본이 모두 이 CNN이다. 정밀도와 재현율의 정의를 알고 있으면 성능 평가 절을 따라가기 쉽다.

## 인식의 세부 문제

인식(recognition)은 분류, 검출, 분할, 추적 등의 세부 문제를 포함하는 넓은 의미의 단어다. 사람과 달리 컴퓨터 비전은 이 문제들을 따로 구분해 푼다.

![치와와 분류 결과, 사람·가방을 박스로 찾은 검출 결과, 사람과 모자 영역을 칠한 분할 결과](./images/dl-object-detection-01.jpg '왼쪽부터 분류, 검출, 분할')

| 문제                 | 출력                                                | 비고                                                                           |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| 분류(classification) | 영상에 있는 물체의 부류. 보통 부류에 대한 확률 벡터 | 예) [COCO](https://cocodataset.org/) 데이터셋은 사람, 자전거, 자동차 등 80부류 |
| 검출(detection)      | 물체를 감싸는 직사각형(바운딩 박스)과 부류 확률     | 부류는 보통 미리 정해져 있다                                                   |
| 분할(segmentation)   | 물체가 점유하는 화소 집합과 부류 확률               | 의미 분할(semantic)과 사례 분할(instance)로 나뉜다                             |

### 사람의 인식과 컴퓨터의 인식

| 사람                                                                                        | 컴퓨터                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 세부 문제를 별도로 수행하지 않고 동시에 수행한다                                            | 여러 세부 문제로 나누고 독립적으로 해결한다                                            |
| 지식 표현과 추론 같은 지능 요소로 명확한 의도를 가진다                                      | 능동적인 의도가 없고, 과업의 목적이 의도를 대신한다                                    |
| 의도에 도움이 되는 부분만 세밀하게 분석하는 선택적 주의집중(selective attention)을 발휘한다 | 대상 물체나 응용 과업에 따라 문제를 구분한다 (사과 따는 로봇은 사과 검출에만 집중한다) |

## 데이터셋과 대회

딥러닝은 데이터셋의 발전에 힘입어 혁신을 이뤘다. [MNIST](http://yann.lecun.com/exdb/mnist/)와 [CIFAR-10](https://www.cs.toronto.edu/~kriz/cifar.html)은 딥러닝 초기 실험용 장난감 데이터셋이고, [ImageNet](https://doi.org/10.1109/CVPR.2009.5206848)은 딥러닝의 발전에 결정적으로 공헌했다.

| 데이터셋                                                                | 규모                                                        | 특징                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| [PASCAL VOC](http://host.robots.ox.ac.uk/pascal/VOC/)                   | 20부류, VOC2012 기준 약 1만 1천 장                          | 2005년 4부류로 시작해 20부류로 확장, 2012년 대회 종료         |
| ImageNet                                                                | 21,841부류, 약 1,400만 장                                   | 일부 영상에 검출용 바운딩 박스 레이블                         |
| [ILSVRC](https://arxiv.org/abs/1409.0575)                               | ImageNet 중 1000부류, 훈련 약 128만·검증 5만·테스트 10만 장 | ICCV(홀수 해), ECCV(짝수 해)와 함께 대회를 열었다             |
| COCO                                                                    | 80부류, 약 33만 장                                          | 분할 정보와 영상을 설명하는 문장(캡션) 제공, 2015~2020년 대회 |
| [Open Images](https://storage.googleapis.com/openimages/web/index.html) | 구글 제공                                                   | 분류, 검출, 분할 정보와 관계(행동) 레이블                     |

![PASCAL VOC 분할, ImageNet 부류 예, COCO 분할과 캡션, Open Images 관계 레이블 샘플](./images/dl-object-detection-02.jpg '데이터셋마다 레이블 종류가 다르다')

특정 분야의 데이터셋도 있다.

| 데이터셋                                                                | 규모                                    |
| ----------------------------------------------------------------------- | --------------------------------------- |
| [DeepFashion](https://mmlab.ie.cuhk.edu.hk/projects/DeepFashion.html)   | 50부류, 약 80만 장                      |
| [Food-101](https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/) | 101부류, 약 10만 장                     |
| [CheXpert](https://stanfordmlgroup.github.io/competitions/chexpert/)    | 환자 65,240명의 흉부 엑스레이 224,316장 |

![DeepFashion의 Ramper·Hoodie, Food-101의 디저트, CheXpert의 흉부 엑스레이](./images/dl-object-detection-03.jpg '패션, 음식, 의료 분야의 데이터셋')

### 대회의 성능 평가

대회에서는 합리적이고 공정한 성능 평가 척도가 중요하고, 세부 문제마다 척도가 다르다.

1. 주최 측은 훈련 집합(영상과 참값 레이블)과 테스트 집합(영상만)을 제공한다.
2. 참가자는 훈련 집합으로 모델을 학습하고, 별도의 검증 집합으로 하이퍼파라미터를 최적화한다.
3. 테스트 집합으로 예측한 결과를 대회 서버에 전송한다.
4. 서버는 자동 채점해 성능을 측정하고 순위를 공지한다.

## 분류

### 고전적 분류 방법론

| 방법론                                | 대상                                                           | 방법                                                 |
| ------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| 사례 분류(instance classification)    | 모양과 텍스처가 고정된 특정 물체(내 차, 교통 표지판 같은 강체) | 물체를 구성하는 직선과 곡선을 분석하는 기하학적 방법 |
| 범주 분류(categorical classification) | 코끼리, 자전거 같은 일반 부류(모양과 자세 변화가 심함)         | 혼재와 가림을 허용해야 하므로 더 어렵다              |

![블록 세계, 일반 실린더, ACRONYM, 양상 그래프](./images/dl-object-detection-04.jpg '사례 분류를 해결하던 고전 기하학 기법')

![사람의 몸을 부품 상자로 표현한 부품 기반 방법](./images/dl-object-detection-05.jpg '범주 분류를 위한 부품 기반 방법')

### 딥러닝 방법론

딥러닝은 범주 분류를 해결하고자 한다. ILSVRC 대회는 2017년에 끝났지만 ImageNet 성능은 계속 올라, 2012년 AlexNet의 top-5 정확률 약 85%가 2021년 Florence-CoSwin-H의 99.02%까지 올랐다.

![2013년부터 2022년까지 ImageNet top-5 정확률 최고 기록 추이](./images/dl-object-detection-06.jpg 'AlexNet, VGG-19, Inception V3, NASNET, FixResNeXt를 거쳐 99%에 도달한다')

### 의사 결정에 대한 설명

인간은 의사 결정의 이유를 설명하는 능력이 뛰어나지만, 딥러닝은 분류 결과의 이유를 설명하지 못하는 치명적 한계를 가진다. 설명 가능성을 확보하려는 연구가 활발하고, 대표 기법이 CAM과 Grad-CAM이다.

![양치질(Brushing teeth)·벌목(Cutting trees) 행동의 근거 영역 히트맵과, 개와 고양이가 함께 있는 원본 영상(Original Image)의 Grad-CAM 고양이('Cat')·개('Dog') 결과](./images/dl-object-detection-07.jpg '같은 영상이라도 고양이를 설명하면 고양이 몸에, 개를 설명하면 개 얼굴에 근거 영역이 놓인다')

## CAM

일반 CNN은 컨볼루션과 서브샘플링 뒤에 FC층을 붙인다. Flatten으로 특징 맵을 펼치는 순간 공간 정보가 사라지므로, 분류 결과가 영상의 어느 위치에서 나왔는지 알 수 없다.

CAM(Class Activation Mapping, [Zhou 외, 2016](https://arxiv.org/abs/1512.04150))은 마지막 컨볼루션층 뒤의 FC층을 전역 평균 풀링(GAP; global average pooling)으로 바꾼다. 지역(local) 평균 풀링과 최대 풀링이 필터 영역 안의 값을 요약한다면, 전역 풀링은 특징 맵 전체를 값 하나로 요약한다.

![컨볼루션층 뒤 마지막 특징 맵에 GAP를 적용하고 가중치 w₁…wₙ으로 부류 점수를 계산한 뒤, 같은 가중치로 특징 맵을 곱해 더한 부류 활성 맵](./images/dl-object-detection-cam.svg '오스트레일리안 테리어 부류의 가중치로 특징 맵을 합치면 개가 있는 영역이 붉어진다')

마지막 특징 맵 `f_k(x, y){:math}`의 GAP 값을 `F_k{:math}`, 부류 c로 가는 가중치를 `w_k^c{:math}`라 하면 부류 점수와 CAM은 다음과 같다.

```math
S_c = \sum_k w_k^c F_k = \sum_k w_k^c \frac{1}{Z}\sum_{x,y} f_k(x, y), \qquad M_c(x, y) = \sum_k w_k^c f_k(x, y)
```

==부류 점수를 만든 가중치를 특징 맵에 그대로 곱해 더하면 위치별 기여도 지도가 된다.== GAP 구조로 바꾼 뒤에는 FC층을 다시 미세 조정(fine-tuning)해 분류 성능을 회복한다.

6×6×3 입력이 Conv/Pool을 거쳐 3×3×4 특징 맵이 되었다면, GAP는 네 채널의 아홉 칸을 각각 평균해 길이 4의 벡터를 만든다.

| 특징 맵 | 아홉 칸의 합           | 평균 `F_k{:math}` |
| ------- | ---------------------- | ----------------- |
| 1       | 2+4+1+2+3+4+4+2+6 = 28 | 3.11              |
| 2       | 2+5+4+1+6+7+9+3+5 = 42 | 4.67              |
| 3       | 2+4+2+1+3+3+1+1+1 = 18 | 2.00              |
| 4       | 0+2+3+1+2−4−1−3+1 = 1  | 0.11              |

FC층은 이 네 값에 부류마다 가중치 `w_1^c, \ldots, w_4^c{:math}`를 곱해 더한 점수로 Dog, Camel, Cat, Cow 같은 부류의 확률을 계산한다.

CAM의 단점은 구조 제약이다. GAP 바로 앞의 끝단 특징 맵으로만 지도를 만들 수 있고, GAP가 없는 모델은 구조를 바꿔 다시 학습해야 한다.

## Grad-CAM

Grad-CAM(Gradient-weighted CAM, [Selvaraju 외, 2017](https://arxiv.org/abs/1610.02391))은 가중치를 그레이디언트로 구한다.

| 특징                        | 내용                                                                              |
| --------------------------- | --------------------------------------------------------------------------------- |
| 구조 제약 없음              | GAP층을 쓰는 별도의 CNN 구조를 따를 필요가 없다                                   |
| 그레이디언트 기반 위치 추정 | 부류 점수를 특징 맵으로 미분한 값으로 채널 중요도를 구한다                        |
| 층 선택 자유                | 그레이디언트는 어느 층에서나 구할 수 있으므로 마지막 층이 아니어도 적용할 수 있다 |

```math
\alpha_k^c = \frac{1}{Z}\sum_i \sum_j \frac{\partial y^c}{\partial A_{ij}^k}, \qquad L_{\text{Grad-CAM}}^c = \mathrm{ReLU}\left(\sum_k \alpha_k^c A^k\right)
```

`y^c{:math}`는 softmax 이전의 부류 c 점수, `A^k{:math}`는 k번째 특징 맵, Z는 특징 맵의 화소 수다. ReLU는 부류 c에 양의 영향을 주는 위치만 남긴다. GAP 구조에서는 `\alpha_k^c{:math}`가 CAM의 `w_k^c{:math}`에 비례하므로 Grad-CAM은 CAM의 일반화다.

다음 예제는 ResNet50의 마지막 합성곱 블록 출력 `conv5_block3_out`(7×7×2048)에서 wood_rabbit(ImageNet 330번 부류)의 Grad-CAM을 구한다.

```python
import tensorflow as tf
tf.compat.v1.disable_eager_execution()
import cv2 as cv
import numpy as np
from tensorflow.keras.applications.resnet50 import ResNet50, preprocess_input, decode_predictions
from keras import backend as K

model = ResNet50(weights='imagenet')
img = cv.imread('rabbit.jpg')
x = preprocess_input(np.reshape(cv.resize(img, (224, 224)), (1, 224, 224, 3)))
preds = model.predict(x)
print(np.argmax(preds[0]))  # 330: wood_rabbit

wood_rabbit_output = model.output[:, 330]  # 예측 벡터의 'wood_rabbit' 항목
last_conv_layer = model.get_layer('conv5_block3_out')
grads = K.gradients(wood_rabbit_output, last_conv_layer.output)[0]
pooled_grads = K.mean(grads, axis=(0, 1, 2))  # 채널별 그레이디언트 평균, (2048,)
iterate = K.function([model.input], [pooled_grads, last_conv_layer.output[0]])
pooled_grads_value, conv_layer_output_value = iterate([x])

for i in range(2048):  # 채널의 중요도를 특징 맵 채널에 곱한다
    conv_layer_output_value[:, :, i] *= pooled_grads_value[i]
heatmap = np.mean(conv_layer_output_value, axis=-1)
heatmap = np.maximum(heatmap, 0)
heatmap /= np.max(heatmap)

heatmap = cv.resize(heatmap, (img.shape[1], img.shape[0]))
heatmap = cv.applyColorMap(np.uint8(255 * heatmap), cv.COLORMAP_JET)
superimposed_img = heatmap * 0.4 + img  # 0.4는 히트맵의 강도
```

![토끼 영상에 Grad-CAM 히트맵을 겹친 결과](./images/dl-object-detection-10.jpg 'wood_rabbit 판단의 근거가 몸통 털 부분에 몰려 있다')

같은 코드를 MobileNet과 버스 영상에 적용한 결과는 [컨볼루션 신경망의 구조와 전이 학습](/memo/dl-cnn-transfer-learning)의 Grad-CAM 구현 절에 정리했다.

## 적대적 공격

딥러닝 모델을 속이려는 시도는 쉽게 통한다. 버스 영상에 사람 눈에 보이지 않는 잡음을 섞으면 모델이 타조로 분류하고([Szegedy 외, 2013](https://arxiv.org/abs/1312.6199)), 정지 표지판에 스티커를 붙이면 다른 표지판으로 인식한다. 적대적 공격(adversarial attack)을 막는 방어 전략 연구도 활발하다.

![스쿨버스 영상, 더한 잡음, 잡음을 더한 영상과 스티커를 붙인 정지 표지판](./images/dl-object-detection-11.jpg '왼쪽과 셋째 영상은 사람 눈에 같지만 모델의 분류 결과는 다르다')

## 검출

검출은 분류 정보뿐 아니라 물체의 위치 정보도 함께 알아내야 하므로 분류보다 어렵다. 결과로 물체 위치와 함께 부류 신뢰도(confidence)를 나타내는 확률 벡터를 출력한다. 딥러닝으로 전환하면서 획기적으로 발전했고, 자율주행차가 대표적으로 성공한 응용이다.

## 성능 평가

검출 성능은 주로 COCO 대회의 mAP(mean Average Precision)로 평가한다. 물체 부류마다 AP를 구하고 모든 부류에 대해 평균하면 mAP다. AP는 IoU를 기반으로 계산한다.

### IoU

IoU(Intersection over Union)는 예측 박스와 참값 박스의 겹침 정도다.

```math
\mathrm{IoU} = \frac{\mathrm{area}(B_{predict} \cap B_{GT})}{\mathrm{area}(B_{predict} \cup B_{GT})}
```

![사과의 참값 박스(빨강)와 예측 박스(파랑), 교집합과 합집합 영역](./images/dl-object-detection-12.jpg '두 박스가 완전히 겹치면 1, 떨어져 있으면 0이다')

크기가 같은 두 박스도 대각선으로 조금만 어긋나면 IoU가 빠르게 떨어진다.

![6×6 참값 박스와 6×6 예측 박스가 4×4만큼 겹쳐 IoU가 16/56인 계산 예](./images/dl-object-detection-iou.svg '각 변이 2칸씩 어긋났을 뿐인데 IoU는 0.29다')

### AP 계산 알고리즘

1. 신뢰도 임계값을 넘는 예측 박스만 예측 목록에 넣는다.
2. 예측 박스와 참값 박스의 IoU가 임계값을 넘으면 참 긍정(TP), 그렇지 않으면 거짓 긍정(FP)으로 판정한다. 두 개 이상의 참값 박스와 겹치면 IoU가 최대인 쌍을 쓴다.
3. 참 긍정이 발생하면 쌍이 된 참값 박스를 참값 목록에서 제거한다.
4. 예측 목록을 다 처리했는데 쌍을 맺지 못한 참값 박스는 거짓 부정(FN)으로 판정한다.
5. TP, FP, FN으로 정밀도와 재현율을 계산한다.

```math
\text{정밀도} = \frac{TP}{TP + FP}, \qquad \text{재현율} = \frac{TP}{TP + FN}
```

### TP, FP, FN 판정 예

실제 상황에서는 겹치는 박스가 여럿 나타난다. ①~④는 참값 박스, ⓐ~ⓕ는 예측 박스이고 박스 위 숫자는 부류 신뢰도다. IoU 임계값은 0.5다.

![사과 네 개의 참값 박스와 예측 박스 여섯 개를 신뢰도 임계값 0.6과 0.5로 판정한 두 그림](./images/dl-object-detection-13.jpg '신뢰도 임계값을 낮추면 ⓔ가 TP로, ⓕ가 FP로 추가된다')

| 예측 | 신뢰도 | 겹치는 참값 | IoU  | 임계값 0.6 | 임계값 0.5 |
| ---- | ------ | ----------- | ---- | ---------- | ---------- |
| ⓑ    | 0.88   | ②           | 0.86 | TP         | TP         |
| ⓓ    | 0.65   | ④           | 0.12 | FP         | FP         |
| ⓐ    | 0.62   | ①           | 0.6  | TP         | TP         |
| ⓕ    | 0.57   | 없음        | 0.0  | 제외       | FP         |
| ⓔ    | 0.56   | ④           | 0.52 | 제외       | TP         |
| ⓒ    | 0.42   | 없음        | 0.0  | 제외       | 제외       |

참값 ③은 ⓑ와 IoU 0.04로만 겹치므로 어느 경우든 FN이다. 두 설정의 결과를 집계했다.

| 신뢰도 임계값 | TP  | FP  | FN       | 정밀도      | 재현율     |
| ------------- | --- | --- | -------- | ----------- | ---------- |
| 0.6           | 2   | 1   | 2 (③, ④) | 2/3 = 0.667 | 2/4 = 0.5  |
| 0.5           | 3   | 2   | 1 (③)    | 3/5 = 0.6   | 3/4 = 0.75 |

> [!TIP]
> 신뢰도 임계값을 낮추면 예측 박스가 늘어 재현율은 오르지만 FP도 늘어 정밀도가 떨어진다. 임계값 하나로 성능을 말할 수 없기 때문에 모든 임계값을 훑는 정밀도-재현율 곡선과 그 아래 넓이인 AP를 쓴다.

### 정밀도-재현율 곡선과 mAP

예측을 신뢰도 내림차순으로 정렬하고 하나씩 목록에 넣으면서 정밀도와 재현율을 계산하면 다음과 같다.

| 순서 | 예측 | 판정 | 누적 TP | 누적 FP | 정밀도 | 재현율 |
| ---- | ---- | ---- | ------- | ------- | ------ | ------ |
| 1    | ⓑ    | TP   | 1       | 0       | 1.0    | 0.25   |
| 2    | ⓓ    | FP   | 1       | 1       | 0.5    | 0.25   |
| 3    | ⓐ    | TP   | 2       | 1       | 0.667  | 0.5    |
| 4    | ⓕ    | FP   | 2       | 2       | 0.5    | 0.5    |
| 5    | ⓔ    | TP   | 3       | 2       | 0.6    | 0.75   |
| 6    | ⓒ    | FP   | 3       | 3       | 0.5    | 0.75   |

가로축에 재현율, 세로축에 정밀도를 놓고 그리면 정밀도-재현율 곡선이 되고, 곡선 아래 빗금 영역이 AP다. 아래 그림의 곡선은 (0.25, 1.0), (0.5, 0.666), (0.75, 0.6), (0.75, 0.5)를 잇는다.

![(0.25, 1.0), (0.5, 0.666), (0.75, 0.6), (0.75, 0.5)를 잇는 정밀도-재현율 곡선과 빗금 친 AP 영역](./images/dl-object-detection-14.jpg '빗금 영역의 넓이가 AP다')

PASCAL VOC 방식처럼 각 재현율 구간의 정밀도를 그 이후 최대 정밀도로 보간하면 이 예의 AP는 다음과 같다. 재현율 0.75를 넘는 구간은 도달하지 못했으므로 0이다.

```math
AP = 0.25 \times 1.0 + 0.25 \times 0.667 + 0.25 \times 0.6 \approx 0.567
```

==모든 부류에 대해 AP를 구한 다음 평균하면 mAP다.== COCO는 IoU 임계값을 0.5부터 0.95까지 0.05 간격으로 바꿔 가며 구한 mAP를 다시 평균한 값(mAP@[.5:.95])을 주 척도로 쓴다.

## 두 단계 방법론과 한 단계 방법론

| 방법론  | 방식                                                               | 대표 모델 |
| ------- | ------------------------------------------------------------------ | --------- |
| 두 단계 | 물체가 있을 만한 후보 영역을 생성하고, 분류로 물체 여부를 판정한다 | RCNN 계열 |
| 한 단계 | 위치와 분류 정보를 묶어 두 문제를 동시에 해결한다                  | YOLO 계열 |

기존 방법은 다양한 크기의 윈도우를 영상 전체에 움직이며 탐색하는 슬라이딩 윈도우(sliding window) 방식이었다. 두 단계 방법론은 이 비효율을 줄이려고 물체가 있을 만한 영역만 후보로 생성한다.

![RCNN부터 G-RCNN까지 두 단계 계열과 MultiBox부터 YOLOR까지 한 단계 계열의 연표](./images/dl-object-detection-15.jpg 'RCNN(2014)과 YOLO(2016)가 두 계열의 출발점이다')

## RCNN

RCNN(Regions with CNN features, [Girshick 외, 2014](https://arxiv.org/abs/1311.2524))은 VOC2012에서 이전 최고 방법보다 mAP를 30% 넘게(상대 비율) 끌어올린 두 단계 방법이다. 1단계 영역 제안(region proposal)은 부류와 무관하게 물체의 영역을 찾고, 2단계 영역 분류(region classification)는 각 영역의 부류를 판정한다.

![입력 영상, 약 2000개 영역 제안 추출, 227×227로 변형한 영역의 CNN 특징 계산, 비행기·사람·TV 모니터 여부를 판정하는 영역 분류의 네 단계](./images/dl-object-detection-rcnn.svg '영역마다 CNN을 따로 실행한다')

| 단계 | 처리                                                 |
| ---- | ---------------------------------------------------- |
| 1    | 입력 영상을 받는다                                   |
| 2    | 상향식(bottom-up)으로 영역 제안 약 2000개를 추출한다 |
| 3    | 각 영역을 큰 CNN에 넣어 특징을 계산한다              |
| 4    | 부류별 선형 SVM으로 각 영역을 분류한다               |

### 영역 제안: 선택적 탐색

영역 제안에는 선택적 탐색(selective search) 알고리즘을 쓴다. 작은 영역으로 과분할한 뒤 색, 텍스처, 크기가 비슷한 이웃 영역을 계속 묶어, 영상 전체가 한 영역이 될 때까지 그룹화를 반복한다. 그룹화 과정에서 나온 모든 영역의 바운딩 박스가 후보가 된다.

![영역을 점점 크게 묶는 선택적 탐색의 분할 결과와 그에 대응하는 후보 박스](./images/dl-object-detection-17.jpg '작은 영역이 합쳐지며 양 떼, 사람 같은 물체 단위 박스가 생긴다')

### 특징 추출과 분류

후보 영역은 크기가 제각각이므로 227×227 RGB 영상으로 변형(warp)해 CNN에 넣는다. CNN은 컨볼루션층 5개와 FC층 2개로 구성된 AlexNet 구조이고, 출력은 4096차원 특징 벡터다.

![VOC2007 훈련 집합에서 aeroplane, bicycle, bird, car 영역을 227×227로 변형한 샘플](./images/dl-object-detection-18.jpg '종횡비와 무관하게 정사각형으로 늘린다')

부류별 선형 SVM은 4096차원 특징 벡터를 입력받아 부류마다 점수를 낸다. 아래 그림은 VOC 20부류에 물체 아님(non object)을 더한 21개 SVM으로 표현한다. 모든 영역에 점수를 매긴 뒤 탐욕적 비최대 억제(greedy non-maximum suppression)를 적용한다.

![축구 영상에서 영역을 제안하고 227×227 CNN으로 4096차원 특징을 뽑아 SVM 21개로 분류하는 과정](./images/dl-object-detection-19.jpg '영역 제안, 특징 추출, 분류가 분리되어 있다')

> [!NOTE] 비최대 억제
> 비최대 억제(NMS)는 한 물체에 겹쳐 나온 박스 중 신뢰도가 가장 높은 박스만 남기는 후처리다. 신뢰도 내림차순으로 박스를 고르고, 고른 박스와 IoU가 임계값을 넘는 나머지 박스를 삭제하는 과정을 반복한다.

같은 부류의 박스 A(신뢰도 0.9), B(0.8), C(0.7)가 있고 IoU 임계값이 0.5라 한다. IoU(A, B) = 0.7, IoU(A, C) = 0.1, IoU(B, C) = 0.2이다.

| 단계 | 고른 박스 | 남은 후보와의 IoU | 처리      | 남은 후보 |
| ---- | --------- | ----------------- | --------- | --------- |
| 1    | A (0.9)   | B 0.7, C 0.1      | B 삭제    | C         |
| 2    | C (0.7)   | 없음              | 그대로 둠 | 없음      |

결과는 A와 C 두 박스다. B는 A와 같은 물체를 가리키는 중복 박스로 판단되어 지워지고, C는 A와 거의 겹치지 않으므로 다른 물체로 남는다.

### RCNN의 한계

- 영역 제안에 고전적인 방법(선택적 탐색)을 쓰고, 분류에도 SVM을 쓴다.
- 영역마다 독립적으로 CNN을 통과시키므로 영상 한 장에 CNN을 약 2000번 실행해 매우 느리다.

## Fast RCNN

Fast RCNN([Girshick, 2015](https://arxiv.org/abs/1504.08083))은 영상 전체와 영역 제안 목록을 입력으로 받는다.

1. 영상 전체를 컨볼루션층과 최대 풀링층으로 한 번만 처리해 컨볼루션 특징 맵을 만든다.
2. 각 영역 제안을 특징 맵 위로 투영(RoI projection)하고, RoI 풀링층으로 고정 길이 특징 벡터를 추출한다.
3. FC층을 거쳐 softmax 분류(21부류)와 바운딩 박스 회귀(부류마다 x, y, w, h)를 동시에 출력한다.

ImageNet으로 사전 학습한 AlexNet이나 VGG16을 백본으로 쓴다. RoI 풀링은 크기가 다른 영역을 7×7 같은 고정 격자로 나눠 칸마다 최대 풀링하므로 영역 크기와 무관하게 같은 길이의 벡터가 나온다.

![입력 영상을 깊은 CNN에 한 번 통과시킨 컨볼루션 특징 맵에 영역 제안을 RoI 투영하고, RoI 풀링층·FC 2층·4096차원 RoI 특징 벡터를 거쳐 softmax 분류와 박스 회귀로 갈라지는 구조](./images/dl-object-detection-fast-rcnn.svg 'CNN을 영상당 한 번만 실행하고 영역별 계산은 RoI 풀링 뒤에서만 한다')

> [!IMPORTANT] RCNN과 Fast RCNN의 차이
> ==Fast RCNN은 CNN 특징 맵을 모든 영역이 공유하고, 분류와 박스 회귀를 한 신경망에서 함께 학습한다.== 영역 제안은 여전히 선택적 탐색을 쓰며, 이를 신경망(RPN)으로 바꾼 모델이 Faster RCNN([2015](https://arxiv.org/abs/1506.01497))이다.

## YOLO

YOLO(You Only Look Once, [Redmon 외, 2016](https://arxiv.org/abs/1506.02640))는 Fast RCNN·Faster RCNN 같은 두 단계 방법보다 정확률은 떨어지지만 월등히 빠르다. 물체 위치와 부류 정보를 회귀로 한꺼번에 알아내는 한 단계 방법이다.

### 격자와 출력 벡터

1. 영상을 s×s 격자로 나눈다(실험에서는 s = 7).
2. 물체 중심이 놓인 칸이 그 물체를 책임진다.
3. 한 칸은 박스 두 개를 예측하고, 박스마다 위치 (x, y, w, h)와 신뢰도 o를 표현한다.
4. 칸마다 부류 확률 p1~p80을 함께 출력한다.

![7×7 격자 위의 축구 선수와 공, 검정 칸이 책임지는 90차원 벡터](./images/dl-object-detection-21.jpg '빨간 유니폼 선수 영역의 중심이 검정 칸에 놓이므로 검정 칸이 이 선수를 책임진다')

한 칸의 벡터 차원과 전체 출력 크기를 계산하면 다음과 같다.

```math
\underbrace{2 \times (4 + 1)}_{\text{박스 2개}} + \underbrace{80}_{\text{부류 확률}} = 90, \qquad 7 \times 7 \times 90
```

> [!NOTE]
> 원 논문은 PASCAL VOC의 20부류로 실험해 칸마다 2 × 5 + 20 = 30차원, 출력 7×7×30을 썼다. 위 계산은 COCO의 80부류를 기준으로 한 값이다.

### 신경망 구조와 손실 함수

| 항목 | 내용                                                    |
| ---- | ------------------------------------------------------- |
| 층   | 컨볼루션층 24개, 최대 풀링층 4개, FC층 2개              |
| 입력 | 448×448 영상                                            |
| 출력 | 7×7×90 (49칸, 칸마다 90차원 벡터)                       |
| 방식 | 바운딩 박스 회귀와 원핫 코드 분류의 결합                |
| 손실 | 5개 항: 박스 위치와 크기 2개, 신뢰도 2개, 부류 분류 1개 |

![448×448 입력이 C-P-C-P-…-FC-FC를 거쳐 7×7×90 출력이 되는 YOLO 구조](./images/dl-object-detection-22.jpg '컨볼루션 24층 뒤 FC 2층이 7×7×90 텐서를 만든다')

원 논문의 손실 함수에서 `\mathbf{1}_{ij}^{obj}{:math}`는 칸 i의 박스 j가 물체를 책임지면 1이다.

```math
\begin{aligned}
J &= \lambda_{coord} \sum_{i=0}^{s^2} \sum_{j=0}^{B} \mathbf{1}_{ij}^{obj} \left[ (x_i - \hat{x}_i)^2 + (y_i - \hat{y}_i)^2 \right] \\
&+ \lambda_{coord} \sum_{i=0}^{s^2} \sum_{j=0}^{B} \mathbf{1}_{ij}^{obj} \left[ (\sqrt{w_i} - \sqrt{\hat{w}_i})^2 + (\sqrt{h_i} - \sqrt{\hat{h}_i})^2 \right] \\
&+ \sum_{i=0}^{s^2} \sum_{j=0}^{B} \mathbf{1}_{ij}^{obj} (o_i - \hat{o}_i)^2 + \lambda_{noobj} \sum_{i=0}^{s^2} \sum_{j=0}^{B} \mathbf{1}_{ij}^{noobj} (o_i - \hat{o}_i)^2 \\
&+ \sum_{i=0}^{s^2} \mathbf{1}_{i}^{obj} \sum_{c} (p_i(c) - \hat{p}_i(c))^2
\end{aligned}
```

<details>
<summary>각 항의 의미</summary>

| 항  | 대상                      | 설명                                                                           |
| --- | ------------------------- | ------------------------------------------------------------------------------ |
| 1   | 박스 중심 (x, y)          | 물체를 책임지는 박스만 오차를 계산한다                                         |
| 2   | 박스 크기 (w, h)          | 제곱근을 씌워 큰 박스의 작은 오차보다 작은 박스의 작은 오차를 더 크게 반영한다 |
| 3   | 물체가 있는 박스의 신뢰도 | 참값 신뢰도는 예측 박스와 참값 박스의 IoU다                                    |
| 4   | 물체가 없는 박스의 신뢰도 | 대부분의 칸이 배경이므로 `\lambda_{noobj} = 0.5{:math}`로 가중치를 낮춘다      |
| 5   | 부류 확률                 | 물체가 있는 칸만 부류 오차를 계산한다                                          |

위치 항에는 `\lambda_{coord} = 5{:math}`를 곱해 박스 회귀의 비중을 높인다.

</details>

### YOLO v3

YOLO v3([2018](https://arxiv.org/abs/1804.02767))은 여러 스케일을 표현해 다양한 크기의 물체를 검출한다. 448×448 입력을 보폭 32, 16, 8로 줄인 세 층(yolo_82, yolo_94, yolo_106)에서 각각 14×14, 28×28, 56×56 격자로 나누고, 격자 칸마다 박스를 3개까지 책임진다.

![448×448 입력이 yolo_82(14×14), yolo_94(28×28), yolo_106(56×56) 세 출력층으로 나뉘고 칸마다 85차원 벡터 3개를 내는 구조](./images/dl-object-detection-23.jpg '큰 격자는 큰 물체를, 촘촘한 격자는 작은 물체를 맡는다')

| 출력층   | 격자  | 칸 수 | 박스 수 (칸당 3개) |
| -------- | ----- | ----- | ------------------ |
| yolo_82  | 14×14 | 196   | 588                |
| yolo_94  | 28×28 | 784   | 2,352              |
| yolo_106 | 56×56 | 3,136 | 9,408              |
| 합계     |       | 4,116 | 12,348             |

박스 하나의 벡터는 위치 4 + 신뢰도 1 + COCO 80부류 = 85차원이다.

### YOLO v3로 물체 검출하기

OpenCV의 dnn 모듈로 사전 학습된 YOLO v3를 불러와 검출한다. 가중치는 `!wget https://pjreddie.com/media/files/yolov3.weights`로 내려받는다.

```python
import numpy as np
import cv2 as cv
import sys
from google.colab.patches import cv2_imshow

def construct_yolo_v3():  # 사전 학습 모델을 읽어 YOLO 구성
    f = open('coco_names.txt', 'r')
    class_names = [line.strip() for line in f.readlines()]

    model = cv.dnn.readNet('yolov3.weights', 'yolov3.cfg')
    layer_names = model.getLayerNames()
    out_layers = [layer_names[i - 1] for i in model.getUnconnectedOutLayers()]  # yolo_82, yolo_94, yolo_106
    return model, out_layers, class_names

def yolo_detect(img, yolo_model, out_layers):  # YOLO 모델로 물체 검출
    height, width = img.shape[0], img.shape[1]
    test_img = cv.dnn.blobFromImage(img, 1.0 / 256, (448, 448), (0, 0, 0), swapRB=True)

    yolo_model.setInput(test_img)
    output3 = yolo_model.forward(out_layers)

    box, conf, id = [], [], []  # 박스, 신뢰도, 부류 번호
    for output in output3:
        for vec85 in output:
            scores = vec85[5:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]
            if confidence > 0.5:  # 신뢰도가 0.5를 넘는 경우만 취함
                centerx, centery = int(vec85[0] * width), int(vec85[1] * height)
                w, h = int(vec85[2] * width), int(vec85[3] * height)
                x, y = int(centerx - w / 2), int(centery - h / 2)
                box.append([x, y, w, h])  # NMSBoxes는 (x, y, w, h)를 받는다
                conf.append(float(confidence))
                id.append(class_id)

    ind = cv.dnn.NMSBoxes(box, conf, 0.5, 0.4)  # 비최대 억제로 중복 제거
    objects = [box[i] + [conf[i]] + [id[i]] for i in range(len(box)) if i in ind]
    return objects

model, out_layers, class_names = construct_yolo_v3()
colors = np.random.uniform(0, 255, size=(len(class_names), 3))  # 부류마다 색깔

img = cv.imread('soccer.jpg')
if img is None:
    sys.exit('파일이 없습니다.')

res = yolo_detect(img, model, out_layers)
for i in range(len(res)):  # 검출된 물체를 영상에 표시
    x, y, w, h, confidence, id = res[i]
    text = str(class_names[id]) + '%.3f' % confidence
    cv.rectangle(img, (x, y), (x + w, y + h), colors[id], 2)
    cv.putText(img, text, (x, y + 30), cv.FONT_HERSHEY_PLAIN, 1.5, colors[id], 2)
cv2_imshow(img)
```

| 코드                                                      | 역할                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `getUnconnectedOutLayers()`                               | 뒤에 연결된 층이 없는 출력층, 즉 세 스케일의 YOLO 층 번호를 돌려준다 (1부터 시작해 `i - 1`)                 |
| `blobFromImage(img, 1.0/256, (448, 448), …, swapRB=True)` | 화소를 0~1로 줄이고 448×448로 바꾸며, OpenCV의 BGR을 RGB로 바꾼다                                           |
| `vec85[0:4]`                                              | 영상 크기에 대한 비율로 표현한 박스 중심과 너비·높이                                                        |
| `vec85[5:]`                                               | 80부류 확률. 최댓값의 부류와 확률을 신뢰도로 쓴다                                                           |
| `cv.dnn.NMSBoxes(box, conf, 0.5, 0.4)`                    | (x, y, w, h) 박스 가운데 신뢰도 0.5 이상인 것만 남기고, IoU 0.4를 넘게 겹치는 박스를 비최대 억제로 제거한다 |

축구 영상에서는 두 선수를 각각 1.00과 0.941의 신뢰도로 person 부류로, 공을 0.999의 신뢰도로 sports ball 부류로 검출했다.

![축구 영상에서 선수 두 명을 person, 공을 sports ball로 검출한 결과](./images/dl-object-detection-24.jpg '세 박스 모두 신뢰도 0.94 이상이다')

![계단에 앉은 사람과 가방·컵, 폴로 경기의 사람과 말, 파라솔 아래 여러 사람을 검출한 YOLO v3 결과](./images/dl-object-detection-25.jpg '작은 물체와 겹친 물체도 여러 스케일에서 검출한다')

## 정리

| 주제        | 핵심                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| 인식        | 분류(부류), 검출(박스 + 부류), 분할(화소 + 부류)로 나눠 푼다              |
| 설명 가능성 | CAM은 GAP 가중치로, Grad-CAM은 그레이디언트로 채널 중요도를 구한다        |
| 평가        | IoU로 TP·FP·FN을 판정하고, 정밀도-재현율 곡선 아래 넓이 AP의 평균이 mAP다 |
| 두 단계     | RCNN: 선택적 탐색 + 영역별 CNN + SVM, Fast RCNN: 특징 맵 공유 + RoI 풀링  |
| 한 단계     | YOLO: s×s 격자 회귀로 위치와 부류를 동시에, v3는 세 스케일 격자           |

검출의 박스를 화소 단위로 세분한 분할은 [의미 분할의 성능 평가와 FCN·DeconvNet·U-Net](/memo/dl-segmentation)에서 다룬다.
