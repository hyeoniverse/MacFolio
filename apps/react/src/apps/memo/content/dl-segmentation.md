---
title: 의미 분할의 성능 평가와 FCN·DeconvNet·U-Net
date: 2023-10-09
category: CS/딥러닝
series: 딥러닝 및 응용
seriesOrder: 3
summary: 화소마다 부류를 지정하는 분할 문제의 정의와 PA·IoU·Dice 평가, 특징 맵을 다시 키우는 전치 컨볼루션과 FCN·DeconvNet·U-Net의 구조, Oxford-IIIT Pet 데이터셋을 U-Net으로 분할한 구현을 다룬다.
---

## 들어가기 전에

검출은 물체를 직사각형으로 감싸므로 박스 안에 배경이 섞인다. 굽은 차선, 팔다리를 뻗은 사람, 종양의 경계처럼 모양 자체가 중요한 대상은 박스로 표현할 수 없다. 자율주행차가 주행할 수 있는 노면을 판단하거나 의료 영상에서 병변의 넓이를 재려면 화소 하나하나가 어느 부류에 속하는지 알아야 하고, 이 문제가 분할(segmentation)이다.

분류용 CNN은 이 요구와 반대 방향으로 설계되어 있다. 컨볼루션과 풀링을 거듭하며 특징 맵이 줄어 224×224 입력이 7×7까지 작아지고, 마지막 완전연결층은 그 맵을 일렬로 펼쳐 위치 정보를 버린다. 분할 신경망은 작아진 맵을 다시 입력 크기로 키우면서, 축소 과정에서 잃은 경계의 위치를 되살려야 한다.

이 글이 답하려는 질문은 두 가지다. 줄어든 특징 맵을 어떤 연산으로 원래 크기로 되돌리는가. 그리고 물체의 경계를 정확하게 복원하려면 얕은 층의 정보를 어떤 방식으로 가져와야 하는가.

| 순서 | 내용                                                |
| ---- | --------------------------------------------------- |
| 1    | 분할의 정의, 의미 분할과 사례 분할                  |
| 2    | 성능 평가(PA, IoU, Dice)와 데이터셋                 |
| 3    | FCN: 특징 맵 크기 변화, 전치 컨볼루션, 3단계 스케일 |
| 4    | DeconvNet: 언풀링과 전치 컨볼루션의 대칭 구조       |
| 5    | U-Net: 축소 경로, 확장 경로, 지름길 연결            |
| 6    | U-Net으로 Oxford-IIIT Pet 분할                      |

컨볼루션의 출력 크기 공식과 풀링은 [컨볼루션 신경망의 구조와 전이 학습](/memo/dl-cnn-transfer-learning)에서, 박스에 적용하는 IoU와 검출 문제는 [물체 검출의 성능 평가와 RCNN·YOLO](/memo/dl-object-detection)에서 다뤘다. 이 글은 두 개념을 화소 단위로 확장한다.

## 분할

==분할은 물체가 점유하는 영역, 즉 화소 집합을 지정하고 그 부류 확률을 함께 출력하는 문제다.== 아래 왼쪽은 실내 장면에서 의자·화분 같은 물체를 화소 단위로 칠한 결과이고, 오른쪽은 도로 장면의 모든 화소를 도로·인도·건물·하늘·사람·자동차 등의 부류로 칠한 결과다.

![실내 장면 세 장의 분할 결과와 도로 장면을 부류별 색으로 칠한 분할 결과](./images/dl-segmentation-01.jpg '물체 영역을 화소 단위로 지정하고 부류마다 다른 색을 칠한다')

### 의미 분할과 사례 분할

분할은 같은 부류의 물체를 서로 구별하는지에 따라 두 가지로 나뉜다. 사람·자동차처럼 개수를 집계할 수 있는 물체를 thing, 하늘·도로·잔디처럼 형태가 정해지지 않은 영역을 stuff라 부른다.

| 구분                             | 분할 대상          | 같은 부류의 물체 여럿                 |
| -------------------------------- | ------------------ | ------------------------------------- |
| 의미 분할(semantic segmentation) | thing과 stuff 모두 | 구분하지 않고 같은 부류로 칠한다      |
| 사례 분할(instance segmentation) | thing만            | 물체마다 다른 사례(instance)로 나눈다 |

![자전거 경주 사진, 의미 분할 결과, 사례 분할 결과](./images/dl-segmentation-02.jpg '의미 분할은 세 사람을 모두 같은 색으로, 사례 분할은 사람마다 다른 색으로 칠한다')

의미 분할에서는 세 선수가 모두 사람 부류(분홍), 세 자전거가 모두 자전거 부류(초록)로 칠해진다. 사례 분할에서는 선수 셋과 자전거 셋이 각각 다른 색을 받는다.

## 성능 평가

분할은 화소마다 부류를 지정하는 문제로 볼 수 있으므로, 화소 정확률 PA(pixel accuracy)로 성능을 측정할 수 있다. 분모는 전체 화소 수이고, 분자는 참값(GT, ground truth)과 모델의 예측값이 같은 화소 수다.

```math
\mathrm{PA} = \frac{\sum_{i=0}^{C} p_{ii}}{\sum_{i=0}^{C}\sum_{j=0}^{C} p_{ij}}
```

`p_{ij}{:math}`는 참값이 부류 `i{:math}`인데 부류 `j{:math}`로 예측된 화소 수다. 부류 0은 배경이고 물체 부류가 `C{:math}`개이므로 합은 `0{:math}`부터 `C{:math}`까지다. 대각선 원소 `p_{ii}{:math}`가 맞힌 화소이고, 모든 원소의 합이 전체 화소 수다.

부류 하나의 영역만 따로 평가할 때는 물체 검출에서 상자에 적용한 IoU를 화소 집합에 적용하거나 Dice 계수를 사용한다. `A{:math}`는 참값 영역, `B{:math}`는 예측 영역이다.

```math
\mathrm{IoU} = \frac{|A \cap B|}{|A \cup B|}, \qquad \mathrm{Dice} = \frac{2|A \cap B|}{|A| + |B|}
```

Dice는 분자에서 교집합을 두 번 집계하고 분모에서 두 영역의 크기를 따로 더하므로, 같은 예측이라도 IoU보다 큰 값이 나온다. 두 지표 사이에는 `\mathrm{Dice} = 2\,\mathrm{IoU}/(1+\mathrm{IoU}){:math}` 관계가 성립한다.

<details>
<summary>Dice와 IoU 관계의 유도</summary>

교집합의 크기를 `I = |A \cap B|{:math}`, 합집합의 크기를 `U = |A \cup B|{:math}`라 하면 포함·배제 원리에서 `|A| + |B| = U + I{:math}`이다. 이를 Dice의 분모에 넣는다.

```math
\mathrm{Dice} = \frac{2I}{U + I} = \frac{2\,(I/U)}{1 + I/U} = \frac{2\,\mathrm{IoU}}{1 + \mathrm{IoU}}
```

`0 \le \mathrm{IoU} \le 1{:math}`에서 `1 + \mathrm{IoU} \le 2{:math}`이므로 Dice는 IoU보다 작지 않고, 두 값은 0과 1에서만 같다. 관계가 단조 증가이므로 두 지표로 모델의 순위를 매기면 영상 하나에서는 순위가 같다.

</details>

![6×6 참값과 예측값 격자, 영역 2의 합집합과 교집합](./images/dl-segmentation-03.jpg '영역 2의 교집합은 10화소, 합집합은 17화소다')

### 예제 계산

격자에서 부류 2인 화소를 집계하면 다음과 같다.

| 항목                  | 집계                  | 값  |
| --------------------- | --------------------- | --- |
| 참값 영역 A의 화소 수 | 행별 0, 3, 4, 3, 2, 2 | 14  |
| 예측 영역 B의 화소 수 | 행별 0, 4, 3, 2, 2, 2 | 13  |
| 교집합의 화소 수      | 행별 0, 3, 2, 2, 2, 1 | 10  |
| 합집합의 화소 수      | `14 + 13 - 10{:math}` | 17  |

```math
\mathrm{IoU} = \frac{10}{17} = 0.5882, \qquad \mathrm{Dice} = \frac{2 \times 10}{14 + 13} = \frac{20}{27} = 0.7407
```

같은 격자로 PA도 집계할 수 있다. 36화소 가운데 참값과 예측이 같은 화소는 행별로 6, 5, 3, 5, 6, 4개이므로 `\mathrm{PA} = 29/36 = 0.8056{:math}`이다. 배경(0)이 넓게 맞으면 PA는 높게 나오지만 부류 2의 IoU는 0.59에 그친다.

> [!TIP]
> 배경이 화면 대부분을 차지하는 영상에서는 모든 화소를 배경으로 예측해도 PA가 높다. 그래서 분할 논문은 부류별 IoU를 평균한 mIoU(mean IoU)를 주 지표로 보고한다.

## 데이터셋

[PASCAL VOC](http://host.robots.ox.ac.uk/pascal/VOC/), [ImageNet](https://doi.org/10.1109/CVPR.2009.5206848), [COCO](https://cocodataset.org/), [OpenImages](https://storage.googleapis.com/openimages/web/index.html)는 분할 레이블도 제공한다. 특수 목적이거나 기존 데이터셋을 확장한 분할 데이터셋도 있다.

| 데이터셋                                                                       | 용도                                    |
| ------------------------------------------------------------------------------ | --------------------------------------- |
| [Cityscapes](https://www.cityscapes-dataset.com/)                              | 도심 도로 장면 분할 (자율주행)          |
| [Youtube-Objects](https://calvin-vision.net/datasets/youtube-objects-dataset/) | 유튜브 비디오 분할                      |
| [KITTI](https://www.cvlibs.net/datasets/kitti/)                                | 자율주행                                |
| [NYU-Depth V2](https://cs.nyu.edu/~fergus/datasets/nyu_depth_v2.html)          | RGB-D 분할 (실내 장면의 깊이 영상 포함) |
| [LVIS](https://www.lvisdataset.org/)                                           | COCO를 확장한 대규모 어휘 사례 분할     |

![Cityscapes 도로 장면, LVIS 얼룩말 사례 분할, NYU-Depth V2 실내 영상·깊이·분할](./images/dl-segmentation-04.jpg 'NYU-Depth V2는 컬러 영상, 깊이 영상, 분할 레이블을 함께 제공한다')

## FCN

FCN(Fully Convolutional Networks)은 화소 단위 분할을 통째 학습(end-to-end learning)으로 푼 첫 완전 컨볼루션 신경망이다([Long, Shelhamer, Darrell, CVPR 2015](https://arxiv.org/abs/1411.4038)). 이후 여러 아이디어로 개선한 모델이 등장했고, ==이름이 뜻하듯이 컨볼루션층만으로 구성된다.==

분류용 CNN은 컨볼루션층 뒤에 완전연결층을 두어 영상 전체에 대해 "tabby cat" 같은 부류 하나를 출력한다. 완전연결층은 특징 맵을 일렬로 펼치므로 화소의 위치 정보가 사라진다.

![227×227 입력 영상이 컨볼루션층과 완전연결층을 지나 얼룩고양이(tabby cat)라는 부류 하나가 되는 그림](./images/dl-segmentation-classification-cnn.svg '분류용 CNN은 마지막에 완전연결층을 두어 영상 전체의 부류 하나를 출력한다')

FCN은 완전연결층을 컨볼루션층으로 바꾸어 공간 구조를 유지한다. 입력 `H \times W{:math}`가 컨볼루션과 풀링을 지나 `H/32 \times W/32{:math}`까지 줄어들면, 이 작은 맵에는 영상 정보가 압축되어 있다. 이 맵을 업 샘플링(upsampling)해 다시 `H \times W{:math}`로 키우면 화소마다 부류를 예측할 수 있다.

![H×W 입력이 H/4, H/8, H/16, H/32로 줄어든 뒤 업 샘플링으로 H×W 출력이 되는 FCN 구조](./images/dl-segmentation-fcn-overview.svg '컨볼루션으로 크기가 줄어든 맵에 영상 정보가 남아 있고, 업 샘플링으로 원래 크기를 복원한다')

### 컨볼루션에 따른 특징 맵 크기

`m \times m{:math}` 특징 맵을 `h \times h{:math}` 필터로 컨볼루션해 `m' \times m'{:math}` 맵을 출력한다. 보폭(stride)을 `s{:math}`, 패딩(padding) 크기를 `q{:math}`라 하면 `m'{:math}`가 정해진다.

```math
m' = \left\lfloor \frac{m + 2q - h}{s} \right\rfloor + 1
```

![7×7 맵에 3×3 필터를 보폭과 패딩을 바꿔 적용해 5×5, 4×4, 3×3 맵이 되는 그림](./images/dl-segmentation-07.jpg '같은 7×7 맵이라도 보폭과 패딩에 따라 출력 크기가 달라진다')

| 경우 | `m{:math}` | `h{:math}` | `s{:math}` | `q{:math}` | 계산                                   | `m'{:math}` |
| ---- | ---------- | ---------- | ---------- | ---------- | -------------------------------------- | ----------- |
| (a)  | 7          | 3          | 1          | 0          | `\lfloor (7+0-3)/1 \rfloor + 1{:math}` | 5           |
| (b)  | 7          | 3          | 2          | 1          | `\lfloor (7+2-3)/2 \rfloor + 1{:math}` | 4           |
| (c)  | 7          | 3          | 3          | 1          | `\lfloor (7+2-3)/3 \rfloor + 1{:math}` | 3           |

### 전치 컨볼루션

전치 컨볼루션(transposed convolution)은 `m' \times m'{:math}` 특징 맵을 `m \times m{:math}` 맵으로 업 샘플링해 크기를 키운다. 디컨볼루션(deconvolution)이라고도 부르지만 컨볼루션의 역연산을 계산하는 것은 아니고, 크기만 거꾸로 되돌리는 컨볼루션이다. 다음 세 단계로 수행한다.

1. 행 사이에 `s' = s - 1{:math}`개의 0 행을 삽입하고 열 사이에 `s' = s - 1{:math}`개의 0 열을 삽입한다. 새 영상은 `(s(m'-1)+1) \times (s(m'-1)+1){:math}`이 된다.
2. 새 영상의 가장자리에 `q' = h - q - 1{:math}`만큼 0을 덧댄다. 새 영상은 `(s(m'-1)+2h-2q-1) \times (s(m'-1)+2h-2q-1){:math}`이 된다.
3. 새 영상에 보폭이 1인 `h \times h{:math}` 컨볼루션을 적용한다.

세 단계를 적용한 출력 크기 `m{:math}`는 3단계의 출력 `(s(m'-1)+2h-2q-1) - h + 1{:math}`을 정리한 다음 식으로 정해진다.

```math
m = (m' - 1) \times s + h - 2q
```

![5×5, 4×4, 3×3 맵에 0 행·열 삽입, 0 덧대기, 보폭 1 컨볼루션을 차례로 적용해 7×7로 복원하는 그림](./images/dl-segmentation-08.jpg '앞 그림의 세 경우를 거꾸로 적용하면 모두 7×7로 돌아온다')

| 경우 | `m'{:math}` | `s{:math}`, `q{:math}` | 1단계 (`s'{:math}`) | 2단계 (`q'{:math}`) | 3단계 출력 `m{:math}`         |
| ---- | ----------- | ---------------------- | ------------------- | ------------------- | ----------------------------- |
| (a)  | 5           | 1, 0                   | 0개 삽입 → 5×5      | 2줄 덧댐 → 9×9      | `(5-1)\cdot 1+3-0 = 7{:math}` |
| (b)  | 4           | 2, 1                   | 1개 삽입 → 7×7      | 1줄 덧댐 → 9×9      | `(4-1)\cdot 2+3-2 = 7{:math}` |
| (c)  | 3           | 3, 1                   | 2개 삽입 → 7×7      | 1줄 덧댐 → 9×9      | `(3-1)\cdot 3+3-2 = 7{:math}` |

세 경우 모두 2단계 뒤 9×9가 되고, 3×3 필터를 보폭 1로 적용하면 `9 - 3 + 1 = 7{:math}`이 된다. 필터 가중치는 고정값이 아니라 학습으로 정해지므로, 전치 컨볼루션은 학습 가능한 업 샘플링이다.

### FCN-32s, FCN-16s, FCN-8s

FCN은 VGG16을 바탕으로 한다. 풀링을 다섯 번 거치면 영상 크기가 1/2, 1/4, 1/8, 1/16, 1/32로 줄어들고, conv6-7은 원래의 완전연결층을 바꾼 컨볼루션층이다. 1/32 크기의 마지막 예측을 한 번에 32배 업 샘플링한 모델이 FCN-32s다.

![입력 영상부터 pool5와 conv6-7까지 크기가 1/32로 줄고 32배 업 샘플링하는 FCN-32s](./images/dl-segmentation-fcn-32s.svg 'FCN-32s는 1/32 크기의 예측을 한 번에 32배 키워 경계가 뭉개진다')

32배 업 샘플링한 결과(아래 비교 그림의 FCN-32s)는 사람과 자전거의 대략적인 위치만 맞고 경계는 뭉개진다. 1/32 크기의 맵 한 칸이 원래 영상의 32×32 화소에 해당하기 때문이다. FCN-16s는 conv7의 예측을 2배 업 샘플링한 뒤 pool4(1/16 크기)의 예측과 더하고, 그 결과를 16배 업 샘플링한다.

![pool4의 예측과 2배 업 샘플링한 conv7의 예측을 더한 뒤 16배 업 샘플링하는 FCN-16s](./images/dl-segmentation-fcn-16s.svg 'pool4의 세밀한 정보를 더한 FCN-16s는 FCN-32s보다 경계가 살아난다')

FCN-8s는 같은 방식을 한 번 더 적용한다. conv7 예측을 4배, pool4 예측을 2배 업 샘플링해 pool3(1/8 크기)의 예측과 더하고, 결과를 8배 업 샘플링한다.

![FCN-32s, FCN-16s, FCN-8s 결과와 참값(Ground truth) 비교](./images/dl-segmentation-11.jpg '얕은 층의 맵을 더할수록 맨 오른쪽 참값(Ground truth)의 경계에 가까워진다')

==깊은 층의 맵은 무엇이 있는지(거친 특징)를, 얕은 층의 맵은 어디에 있는지(세밀한 특징)를 담고 있으므로, 둘을 합치면 정확한 분할을 얻는다.== 이 과정을 부류 맵으로 그리면 다음과 같다.

![pool3, pool4, conv7에 C+1개의 1×1 필터를 적용해 부류 맵을 만들고 2배·2배·8배 업 샘플링해 더하는 FCN 구조도](./images/dl-segmentation-12.jpg '1×1 필터로 부류 맵을 만들고, 3단계 스케일을 합쳐 거친 특징과 세밀한 특징을 모두 추출한다')

| 단계 | 동작                                                                                   |
| ---- | -------------------------------------------------------------------------------------- |
| ①    | conv7에 `C+1{:math}`개의 1×1 필터를 적용해 부류별 맵 cmap1을 만든다 (32배 키우면 거침) |
| ②    | pool4에 1×1 필터를 적용하고 2배 키운 ①과 더한다 (16배 키우면 중간)                     |
| ③    | pool3에 1×1 필터를 적용하고 2배 키운 ②와 더한다 (8배 키우면 세밀)                      |
| 출력 | `m \times n \times (C+1){:math}` 텐서. 화소마다 `C+1{:math}`개 부류의 점수를 가진다    |

`C+1{:math}`개의 1×1 필터는 각 위치의 특징 벡터를 부류 점수 벡터로 바꾸는 역할을 한다. 물체 부류 `C{:math}`개와 배경 1개를 합친 수다. 최종 텐서와 참값을 화소마다 비교해 손실을 계산한다.

### FCN의 한계

![버스 영상에서 큰 물체의 레이블이 일관되지 않은 예, 작은 사람을 놓친 예, 개와 자전거의 FCN-8s 결과](./images/dl-segmentation-13.jpg '왼쪽 위는 물체가 커서 레이블이 일관되지 않은 예(inconsistent labels), 왼쪽 아래는 물체가 작아 레이블을 놓친 예(missing labels)다. FCN은 수용장 크기가 고정되어 큰 물체는 조각나고 작은 물체는 사라진다')

| 한계                             | 예                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------- |
| 큰 물체의 레이블이 일관되지 않다 | 버스의 앞 유리에 비친 영역이 car, bicycle, boat, train 등으로 조각나 분류된다 |
| 작은 물체를 놓친다               | 멀리 있는 사람 여럿 가운데 하나만 작게 검출된다                               |
| 세밀한 형태를 복원하지 못한다    | 개의 다리와 자전거 바퀴살이 뭉개져 덩어리 모양이 된다                         |

마지막 문제의 원인은 업 샘플링을 1/8 크기에서 한 번에 8배로 수행하는 데 있다. 이를 해결하려면 업 샘플링도 다운 샘플링처럼 여러 층에 걸쳐 단계적으로 수행해야 하고, 그 구조가 DeconvNet이다.

## DeconvNet

DeconvNet([Noh, Hong, Han, ICCV 2015](https://arxiv.org/abs/1505.04366))은 컨볼루션 네트워크와 디컨볼루션 네트워크를 대칭으로 이어 붙인다.

| 부분                  | 구성                               | 크기 변화                        |
| --------------------- | ---------------------------------- | -------------------------------- |
| Convolution network   | max pooling + convolution          | 224 → 112 → 56 → 28 → 14 → 7 → 1 |
| Deconvolution network | unpooling + transposed convolution | 1 → 7 → 14 → 28 → 56 → 112 → 224 |

![224×224 입력이 최대 풀링으로 1×1까지 줄고 언풀링으로 224×224까지 커지는 DeconvNet 구조](./images/dl-segmentation-deconvnet.svg '컨볼루션 네트워크와 대칭인 디컨볼루션 네트워크가 크기를 단계적으로 복원한다')

### 언풀링

최대 풀링(max pooling)은 2×2 영역에서 최댓값만 남기므로 그 값이 원래 어느 위치에 있었는지 사라진다. ==언풀링(unpooling)은 풀링할 때 최댓값의 위치를 스위치 변수(switch variables)로 기억해 두었다가, 같은 위치로 값을 되돌려 놓고 나머지는 0으로 채운다.==

![4×4 입력을 최대 풀링해 2×2로 줄이고, 기억한 위치로 2×2 값을 되돌려 4×4를 만드는 언풀링 과정](./images/dl-segmentation-unpooling.svg '풀링 때 기억한 최댓값 위치(스위치 변수)로 값을 돌려놓는다')

| 단계          | 입력                                              | 출력                                                                                         |
| ------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Max pooling   | 4×4 입력의 2×2 영역별 최댓값 5, 6, 7, 8과 그 위치 | 2×2 `[[5, 6], [7, 8]]{:math}`                                                                |
| 이후 신경망   | 2×2                                               | 2×2 `[[1, 2], [3, 4]]{:math}`                                                                |
| Max unpooling | 2×2 `[[1, 2], [3, 4]]{:math}`                     | 4×4. 1은 5가 있던 (1,1), 2는 6이 있던 (0,2), 3은 7이 있던 (3,0), 4는 8이 있던 (3,3)에 놓인다 |

언풀링 결과는 대부분이 0인 희소한 맵이다. 그 뒤의 전치 컨볼루션이 희소한 맵을 학습한 필터로 채워 조밀한 맵을 만든다.

![자전거 영상에 대한 디컨볼루션 네트워크 각 층의 활성 맵 열 장](./images/dl-segmentation-16.jpg '언풀링 층의 맵은 점처럼 희소하고, 전치 컨볼루션 층을 지나면 자전거 형태가 채워진다')

DeconvNet 논문의 이 그림은 (a) 입력 영상, (b) 마지막 14×14 디컨볼루션 층, (c) 28×28 언풀링 층, (d) 마지막 28×28 디컨볼루션 층, (e) 56×56 언풀링 층, (f) 마지막 56×56 디컨볼루션 층, (g) 112×112 언풀링 층, (h) 마지막 112×112 디컨볼루션 층, (i) 224×224 언풀링 층, (j) 마지막 224×224 디컨볼루션 층의 활성을 보여 준다. 언풀링은 물체의 위치 정보를 되살리고, 전치 컨볼루션은 형태를 채운다.

![개와 자전거 영상에 대한 FCN-8s와 DeconvNet의 결과 비교](./images/dl-segmentation-17.jpg 'DeconvNet은 FCN-8s보다 개의 다리와 자전거 바퀴의 형태를 잘 살린다')

## U-Net

U-Net([Ronneberger, Fischer, Brox, MICCAI 2015](https://arxiv.org/abs/1505.04597))은 의료 영상 분할을 목적으로 개발되었고, 지금은 자연 영상에까지 널리 사용된다. 다른 신경망처럼 다운 샘플링과 업 샘플링을 수행하고, 지름길 연결(skip connection)로 특징 맵을 전달한다.

![왼쪽 축소 경로, 오른쪽 확장 경로, 가운데를 가로지르는 지름길 연결로 이루어진 U자 모양 U-Net 구조](./images/dl-segmentation-unet.svg '같은 깊이의 축소 경로 특징 맵을 잘라 확장 경로에 이어 붙인다')

| 부분                        | 동작                                                                              |
| --------------------------- | --------------------------------------------------------------------------------- |
| 축소 경로(contracting path) | 3×3 컨볼루션(ReLU) 두 번과 2×2 최대 풀링을 반복. 채널 64 → 128 → 256 → 512 → 1024 |
| 확장 경로(expansive path)   | 2×2 up-conv(전치 컨볼루션)로 크기를 2배, 채널을 1/2로 바꾸고 3×3 컨볼루션 두 번   |
| 지름길 연결(copy and crop)  | 같은 깊이의 축소 경로 특징 맵을 잘라 확장 경로의 맵에 채널 방향으로 이어 붙임     |
| 출력                        | 1×1 컨볼루션으로 부류 수(그림에서는 2)만큼의 채널을 만든다                        |

원 논문의 U-Net은 패딩 없는 컨볼루션을 사용하므로 3×3 컨볼루션마다 크기가 2씩 줄어든다. 컨볼루션 출력 크기 식에 `h=3, q=0, s=1{:math}`을 넣으면 `m' = m - 2{:math}`이다.

| 깊이 | 축소 경로       | 확장 경로              |
| ---- | --------------- | ---------------------- |
| 1    | 572 → 570 → 568 | 392 → 390 → 388 (출력) |
| 2    | 284 → 282 → 280 | 200 → 198 → 196        |
| 3    | 140 → 138 → 136 | 104 → 102 → 100        |
| 4    | 68 → 66 → 64    | 56 → 54 → 52           |
| 바닥 | 32 → 30 → 28    |                        |

바닥의 28×28을 2배 업 샘플링하면 56×56인데, 같은 깊이의 축소 경로 맵은 64×64다. 크기가 맞지 않으므로 64×64의 가운데 56×56만 잘라(crop) 이어 붙인다. 그래서 572×572 입력에 대한 출력이 388×388이다.

### 지름길 연결

FCN도 얕은 층의 정보를 가져오지만, 1×1 필터로 부류 맵을 만든 뒤 원소별로 더한다. U-Net은 특징 맵 자체를 채널 방향으로 이어 붙이고(concatenate) 그 뒤의 컨볼루션이 두 맵을 어떻게 섞을지 학습한다.

![FCN은 C+1 채널 부류 맵을 원소별로 더하고, U-Net은 512 채널 특징 맵 두 개를 이어 붙여 1024 채널을 만드는 비교 도식](./images/dl-segmentation-skip.svg 'FCN은 부류 점수를 더하고, U-Net은 특징 맵을 이어 붙인 뒤 컨볼루션으로 섞는다')

> [!NOTE]
> 지름길 연결이 축소 경로의 세밀한 위치 정보를 확장 경로에 그대로 전달하므로, U-Net은 DeconvNet처럼 스위치 변수를 기억하지 않고도 경계를 정확하게 복원한다. 의료 영상처럼 학습 데이터가 적은 분야에서 U-Net이 표준 구조가 된 이유이기도 하다.

## U-Net을 이용한 분할

U-Net으로 [Oxford-IIIT Pet](https://www.robots.ox.ac.uk/~vgg/data/pets/) 데이터셋의 영상을 분할한다. 이 데이터셋은 고양이·개 37종의 사진과, 화소마다 세 부류 가운데 하나를 지정한 trimap 마스크를 제공한다.

| 부류    | 의미                               |
| ------- | ---------------------------------- |
| Class 1 | 애완동물에 속하는 화소             |
| Class 2 | 배경 화소                          |
| Class 3 | 애완동물과 배경 사이에 인접한 화소 |

![고양이 입력 영상과 동물·배경·경계를 세 색으로 칠한 참값 마스크](./images/dl-segmentation-19.jpg '동물(보라), 배경(청록), 경계(노랑) 세 부류로 이루어진 trimap 마스크')

### 패키지와 데이터

```python
!pip install -q git+https://github.com/tensorflow/examples.git
!pip install -q -U tfds-nightly

from tensorflow import keras
import numpy as np
from tensorflow.keras.preprocessing.image import load_img
from tensorflow.keras import layers
import os
import random
import cv2 as cv
import tensorflow as tf

import tensorflow_datasets as tfds
tfds.disable_progress_bar()

tfds.load('oxford_iiit_pet:3.*.*', with_info=True)
```

`tfds.load(){:python}`는 데이터셋을 내려받아 `/root/tensorflow_datasets/downloads/extracted/` 아래에 압축을 푼다. 아래 코드는 이 폴더의 원본 jpg와 trimap png를 직접 읽는다.

```python
input_dir = '/root/tensorflow_datasets/downloads/extracted/images/'
target_dir = '/root/tensorflow_datasets/downloads/extracted/annotations/trimaps/'
img_siz = (160, 160)  # 모델에 입력되는 영상 크기
n_class = 3           # 분할 레이블 (1:물체, 2:배경, 3:경계)
batch_siz = 32        # 미니 배치 크기

img_paths = sorted([os.path.join(input_dir, f) for f in os.listdir(input_dir) if f.endswith('.jpg')])
label_paths = sorted([os.path.join(target_dir, f) for f in os.listdir(target_dir)
                      if f.endswith('.png') and not f.startswith('.')])
```

압축을 푼 폴더 이름에는 `TAR_GZ.robots.ox.ac.uk_vgg_pets_images...tar.gz` 같은 해시가 붙으므로, `input_dir`과 `target_dir`은 그 폴더의 경로로 지정한다. 두 목록을 파일 이름으로 정렬하므로 같은 번호의 영상과 마스크가 짝이 된다.

### 미니 배치를 만드는 Sequence

```python
class OxfordPets(keras.utils.Sequence):
    def __init__(self, batch_size, img_size, img_paths, label_paths):
        self.batch_size = batch_size
        self.img_size = img_size
        self.img_paths = img_paths
        self.label_paths = label_paths

    def __len__(self):
        return len(self.label_paths) // self.batch_size

    def __getitem__(self, idx):
        i = idx * self.batch_size
        batch_img_paths = self.img_paths[i:i + self.batch_size]
        batch_label_paths = self.label_paths[i:i + self.batch_size]
        x = np.zeros((self.batch_size,) + self.img_size + (3,), dtype="float32")
        for j, path in enumerate(batch_img_paths):
            img = load_img(path, target_size=self.img_size)
            x[j] = img
        y = np.zeros((self.batch_size,) + self.img_size + (1,), dtype="uint8")
        for j, path in enumerate(batch_label_paths):
            img = load_img(path, target_size=self.img_size, color_mode="grayscale")
            y[j] = np.expand_dims(img, 2)
            y[j] -= 1  # 부류 번호를 1,2,3에서 0,1,2로 변환
        return x, y
```

| 줄                     | 의미                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `keras.utils.Sequence` | `__len__`과 `__getitem__`을 구현하면 `fit()`이 배치를 하나씩 요청한다                      |
| `__len__`              | 배치 개수. 나머지는 버린다                                                                 |
| `x`의 모양             | `(32, 160, 160, 3)`. 영상을 160×160으로 줄여 담는다                                        |
| `y`의 모양             | `(32, 160, 160, 1)`. 마스크를 회색조로 읽고 채널 축을 하나 추가한다                        |
| `y[j] -= 1`            | trimap의 1, 2, 3을 0, 1, 2로 바꾼다. sparse 교차 엔트로피는 0부터 시작하는 정수를 요구한다 |

### U-Net 모델

```python
def conv2d_block(input_tensor, n_filters, kernel_size=3):
    x = input_tensor
    for i in range(2):
        x = layers.SeparableConv2D(filters=n_filters, kernel_size=(kernel_size, kernel_size),
                                   kernel_initializer='he_normal', padding='same')(x)
        x = layers.Activation('relu')(x)
    return x

def encoder_block(inputs, n_filters=64, pool_size=(2, 2), dropout=0.3):
    f = conv2d_block(inputs, n_filters=n_filters)
    p = layers.MaxPooling2D(pool_size=pool_size)(f)
    p = layers.Dropout(dropout)(p)
    return f, p

def encoder(inputs):
    f1, p1 = encoder_block(inputs, n_filters=64, pool_size=(2, 2), dropout=0.3)
    f2, p2 = encoder_block(p1, n_filters=128, pool_size=(2, 2), dropout=0.3)
    f3, p3 = encoder_block(p2, n_filters=256, pool_size=(2, 2), dropout=0.3)
    f4, p4 = encoder_block(p3, n_filters=512, pool_size=(2, 2), dropout=0.3)
    return p4, (f1, f2, f3, f4)

def bottleneck(inputs):
    bottle_neck = conv2d_block(inputs, n_filters=1024)
    return bottle_neck

def decoder_block(inputs, conv_output, n_filters=64, kernel_size=3, strides=2, dropout=0.3):
    u = layers.Conv2DTranspose(n_filters, kernel_size, strides=strides, padding='same')(inputs)
    c = layers.concatenate([u, conv_output])
    c = layers.Dropout(dropout)(c)
    c = conv2d_block(c, n_filters, kernel_size=3)
    return c

def decoder(inputs, convs, output_channels):
    f1, f2, f3, f4 = convs
    c6 = decoder_block(inputs, f4, n_filters=512, kernel_size=(3, 3), strides=(2, 2), dropout=0.3)
    c7 = decoder_block(c6, f3, n_filters=256, kernel_size=(3, 3), strides=(2, 2), dropout=0.3)
    c8 = decoder_block(c7, f2, n_filters=128, kernel_size=(3, 3), strides=(2, 2), dropout=0.3)
    c9 = decoder_block(c8, f1, n_filters=64, kernel_size=(3, 3), strides=(2, 2), dropout=0.3)
    outputs = tf.keras.layers.Conv2D(output_channels, (1, 1), activation='softmax')(c9)
    return outputs

def make_model(img_size, num_classes):
    inputs = keras.Input(shape=img_size + (3,))
    encoder_output, convs = encoder(inputs)
    # feed the encoder output to the bottleneck
    bottle_neck = bottleneck(encoder_output)
    # feed the bottleneck and encoder block outputs to the decoder
    # specify the number of classes via the `output_channels` argument
    outputs = decoder(bottle_neck, convs, output_channels=num_classes)
    # create the model
    model = keras.Model(inputs=inputs, outputs=outputs)
    return model
```

`padding='same'`이므로 컨볼루션은 크기를 바꾸지 않고, 풀링과 전치 컨볼루션만 크기를 바꾼다. 원 논문과 달리 잘라 내기(crop) 없이 바로 이어 붙일 수 있다.

| 단계              | 출력 크기                  | 지름길로 보관 |
| ----------------- | -------------------------- | ------------- |
| 입력              | 160×160×3                  |               |
| encoder_block 1   | f1 160×160×64, p1 80×80×64 | f1            |
| encoder_block 2   | f2 80×80×128, p2 40×40×128 | f2            |
| encoder_block 3   | f3 40×40×256, p3 20×20×256 | f3            |
| encoder_block 4   | f4 20×20×512, p4 10×10×512 | f4            |
| bottleneck        | 10×10×1024                 |               |
| c6 (+ f4)         | 20×20×512                  |               |
| c7 (+ f3)         | 40×40×256                  |               |
| c8 (+ f2)         | 80×80×128                  |               |
| c9 (+ f1)         | 160×160×64                 |               |
| 1×1 conv, softmax | 160×160×3                  |               |

`Conv2DTranspose`에 `padding='same'`과 `strides=(2, 2)`를 주면 출력 크기는 입력의 정확히 2배가 된다. `SeparableConv2D`는 채널별 공간 컨볼루션과 1×1 컨볼루션으로 나누어 계산하는 층으로, 일반 컨볼루션보다 파라미터가 적다. 마지막 1×1 컨볼루션이 화소마다 세 부류의 확률을 출력하는 점은 FCN의 `C+1{:math}`개 1×1 필터와 같다.

### 학습과 예측

```python
model = make_model(img_siz, n_class)

random.Random(1).shuffle(img_paths)
random.Random(1).shuffle(label_paths)
test_samples = int(len(img_paths) * 0.1)  # 10%를 테스트 집합으로 사용
train_img_paths = img_paths[:-test_samples]
train_label_paths = label_paths[:-test_samples]
test_img_paths = img_paths[-test_samples:]
test_label_paths = label_paths[-test_samples:]

train_gen = OxfordPets(batch_siz, img_siz, train_img_paths, train_label_paths)  # 훈련 집합
test_gen = OxfordPets(batch_siz, img_siz, test_img_paths, test_label_paths)      # 검증 집합

model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
cb = [keras.callbacks.ModelCheckpoint('oxford_seg.h5', save_best_only=True)]  # 학습 결과 자동 저장
model.fit(train_gen, epochs=15, validation_data=test_gen, callbacks=cb)
```

`random.Random(1)`로 같은 시드의 난수 생성기를 두 번 만들어 섞으므로, 길이가 같은 두 목록은 같은 순서로 섞여 영상과 마스크의 짝이 유지된다. 손실 함수 `sparse_categorical_crossentropy`는 정수 레이블(0, 1, 2)과 소프트맥스 확률을 화소마다 비교한다. `ModelCheckpoint`는 검증 손실이 가장 낮은 시점의 모델만 `oxford_seg.h5`로 보관한다.

```python
from google.colab.patches import cv2_imshow

preds = model.predict(test_gen)  # 예측

img = cv.imread(test_img_paths[1])
img = cv.resize(img, (160, 160))
cv2_imshow(img)  # 1번 영상 디스플레이

label = cv.imread(test_label_paths[1])
label = cv.resize(label, (160, 160))
cv2_imshow(label * 64)

cv2_imshow(preds[1] * 255)  # 1번 영상 예측 결과 디스플레이 (각 클래스의 확률에 255를 곱해서 color 값으로 생성)
cv.waitKey()
cv.destroyAllWindows()

print(preds[1].shape)
```

마스크 값은 1~3이라 그대로 표시하면 거의 검게 보이므로 64를 곱해 64, 128, 192의 회색으로 표시한다. 예측 `preds[1]`은 `(160, 160, 3)` 확률 텐서이고, 255를 곱하면 세 부류의 확률이 세 색 채널이 된다. OpenCV는 채널을 BGR 순서로 해석하므로 동물(0번)은 파랑, 배경(1번)은 초록, 경계(2번)는 빨강으로 나타난다.

![고양이 입력, 회색조 참값 마스크, 파랑·초록·빨강으로 표시한 (160, 160, 3) 예측 결과](./images/dl-segmentation-20.jpg '동물은 파랑, 배경은 초록, 경계는 빨강으로 예측되었다')

### 설정을 바꾼 실행

테스트 집합 비율과 epoch 수를 바꾸어 다시 실행했다.

| 항목             | 앞의 코드 | 바꾼 값   |
| ---------------- | --------- | --------- |
| 테스트 집합 비율 | 0.1 (10%) | 0.2 (20%) |
| epoch 수         | 15        | 10        |

영상이 7390장이므로 테스트 집합은 `int(7390 \times 0.2) = 1478{:math}`장, 훈련 집합은 5912장이다. 배치 크기 32로 나누면 훈련 배치는 `5912 // 32 = 184{:math}`개, 검증 배치는 `1478 // 32 = 46{:math}`개이고, 로그의 184/184와 46/46이 이 값이다.

![10 epoch 동안 손실이 0.8774에서 0.3646으로 줄어드는 학습 로그](./images/dl-segmentation-21.jpg '훈련 손실과 검증 손실은 꾸준히 감소한다 (발표 자료)')

| epoch | loss   | val_loss |
| ----- | ------ | -------- |
| 1     | 0.8774 | 0.7634   |
| 2     | 0.7231 | 0.6602   |
| 5     | 0.4874 | 0.4425   |
| 8     | 0.3970 | 0.3929   |
| 10    | 0.3646 | 0.3605   |

첫 epoch의 경고는 `.h5`(HDF5) 형식으로 저장할 때 Keras가 출력하는 형식 안내다.

![개 네 마리의 입력 영상, 참값 마스크, 파랑·초록·빨강으로 표시한 예측 결과](./images/dl-segmentation-22.jpg '예측 마스크는 개의 윤곽을 따라 경계(빨강)를 그린다 (발표 자료)')

10 epoch 동안 훈련 손실은 0.8774에서 0.3646으로, 검증 손실은 0.7634에서 0.3605로 감소했고, 예측 마스크는 개의 윤곽을 따라간다. 분할 품질을 수치로 평가하려면 예측의 argmax와 레이블을 화소마다 비교해 앞에서 정리한 PA와 부류별 IoU를 집계한다.

## 정리

| 모델      | 다운 샘플링         | 업 샘플링                         | 얕은 층 정보를 가져오는 방법            |
| --------- | ------------------- | --------------------------------- | --------------------------------------- |
| FCN       | VGG16 (1/32까지)    | 전치 컨볼루션 2배·2배·8배         | 1×1 필터로 만든 부류 맵을 원소별로 더함 |
| DeconvNet | VGG16 (1×1까지)     | 언풀링 + 전치 컨볼루션을 대칭으로 | 풀링의 최댓값 위치(스위치 변수)         |
| U-Net     | 3×3 컨볼루션 + 풀링 | 2×2 up-conv + 3×3 컨볼루션        | 특징 맵을 채널 방향으로 이어 붙임       |

==세 모델은 모두 인코더가 줄인 특징 맵을 디코더가 다시 키우는 구조이고, 차이는 업 샘플링을 얼마나 단계적으로 하는지와 얕은 층의 위치 정보를 어떻게 되살리는지에 있다.== 영상 대신 시간 순서가 있는 데이터를 다루는 신경망은 [순환 신경망과 LSTM으로 만든 시계열 예측](/memo/dl-rnn)에서 다룬다.
