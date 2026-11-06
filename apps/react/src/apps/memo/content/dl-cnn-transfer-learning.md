---
title: 컨볼루션 신경망의 구조와 전이 학습
date: 2023-09-11
category: 학습/CS/딥러닝
series: 딥러닝 및 응용
seriesOrder: 1
summary: 컨볼루션 신경망의 컨볼루션·패딩·스트라이드·풀링, 출력 크기와 파라미터 수 계산, LeNet-5부터 SENet까지의 대표 구조, 손실 함수와 옵티마이저, 사전 학습 모델을 백본으로 쓰는 전이 학습, Grad-CAM 시각화를 정리했다.
---

## 들어가기 전에

28×28 필기 숫자 영상을 다층 퍼셉트론에 넣으려면 화소를 한 줄로 이어 784차원 벡터로 만들어야 한다. 이 순간 위아래로 붙어 있던 두 화소는 벡터에서 28칸 떨어진 원소가 되고, 같은 숫자를 오른쪽으로 두 화소만 옮겨도 획이 놓인 원소가 대부분 다른 자리로 바뀐다. 다층 퍼셉트론은 어느 원소끼리 이웃인지 모르는 채로 이 관계를 데이터에서 처음부터 배워야 하고, 입력 화소마다 다음 층의 모든 노드와 연결되므로 영상이 커질수록 가중치 수가 급격히 늘어난다.

컨볼루션 신경망(CNN; convolutional neural network)은 영상을 펼치지 않고 가로, 세로, 채널의 구조 그대로 받는다. 작은 필터 하나를 영상 전체에 옮겨 가며 같은 가중치로 특징을 뽑으므로 이웃 화소의 관계가 필터 안에서 유지되고, 학습할 가중치는 필터 크기만큼으로 줄어든다. 2012년 AlexNet 이후 영상 인식의 기본 구조가 된 것도 이 두 성질 덕분이다.

이 글이 답하려는 질문은 두 가지다. 컨볼루션층과 풀링층은 어떤 계산으로 공간 구조를 유지하면서 가중치 수를 줄이는가. 그리고 ImageNet 같은 대규모 데이터로 학습한 모델을 데이터가 적은 새 문제에 어떻게 옮겨 쓰는가.

| 순서 | 내용                                                                              |
| ---- | --------------------------------------------------------------------------------- |
| 1    | 다층 퍼셉트론의 문제, 컨볼루션·패딩·스트라이드·풀링, 출력 크기와 파라미터 수 계산 |
| 2    | 빌딩블록으로 쌓는 CNN, LeNet-5 재현과 CIFAR-10 인식                               |
| 3    | 손실 함수(교차 엔트로피, Focal 손실), 옵티마이저, 규제                            |
| 4    | AlexNet부터 SENet까지 대표 CNN 모델과 정확률·계산량 비교                          |
| 5    | 사전 학습 모델을 백본으로 쓰는 전이 학습과 미세 조정                              |
| 6    | Grad-CAM으로 CNN의 판단 근거 시각화                                               |

다층 퍼셉트론의 전방 계산, 역전파, 경사 하강법은 안다고 가정하고 바로 쓴다. 예제 코드는 TensorFlow(Keras)로 작성했다.

## 다층 퍼셉트론의 문제

다층 퍼셉트론(MLP; multi-layer perceptron)은 퍼셉트론을 여러 층으로 쌓은 신경망이다. 입력층과 출력층 사이에 은닉층이 있고, 각 층은 가중치와 입력의 선형 결합을 계산한 뒤 활성화 함수(sigmoid, softmax 등)로 비선형 변환을 한다. 은닉층이 하나이면 얕은 신경망, 둘 이상이면 깊은 신경망이다.

[MNIST](http://yann.lecun.com/exdb/mnist/)나 [CIFAR-10](https://www.cs.toronto.edu/~kriz/cifar.html) 같은 영상을 MLP에 넣으려면 2차원 영상을 1차원 특징 벡터로 펼치고, 레이블은 원핫 코드(정답 부류만 1이고 나머지는 0인 벡터)로 표현한다.

| 데이터셋 | 영상 크기       | 특징 벡터 차원 | 레이블 예                      |
| -------- | --------------- | -------------- | ------------------------------ |
| MNIST    | 28×28 명암 영상 | 784            | 숫자 5 → (0,0,0,0,0,1,0,0,0,0) |
| CIFAR-10 | 32×32 컬러 영상 | 3072 (32×32×3) | 9번째 부류 → (0,…,0,1,0)       |

이 방식에는 두 가지 문제가 있다.

| 문제                             | 내용                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| 1차원으로 펼칠 때 정보 손실      | 이웃 화소 사이의 공간 정보(위아래 관계)가 사라진다                                          |
| 완전연결(FC)층의 과다한 매개변수 | 256×256×3 영상 하나에 입력 노드 196,608개가 필요하고, 노드마다 다음 층 모든 노드와 연결된다 |

![4×4 영상 A, B와 이를 16칸 1차원 벡터로 펼친 A′, B′](./images/dl-cnn-transfer-learning-01.jpg '2차원에서 이웃한 1이 1차원에서는 멀리 떨어진다')

A의 (2,2), (3,1), (3,2) 화소는 2차원에서 서로 붙어 있지만 1차원 벡터 A′에서는 6번째, 9번째, 10번째 칸으로 흩어진다. MLP는 이 거리 관계를 알 수 없다.

## 컨볼루션 신경망의 구조

인간 시각의 수용장(receptive field)은 망막의 일부 영역에만 반응하고, 이를 모방한 신경망이 후쿠시마의 네오코그니트론(neocognitron, [1980](https://doi.org/10.1007/BF00344251))이다. CNN은 이 아이디어를 이어받아 ==컨볼루션 연산으로 공간 구조를 유지한 채 특징을 추출하고, 최적의 필터(마스크, 커널)를 학습으로 알아낸다.== 추출한 특징은 분류, 검출, 분할에 쓴다.

### 컨볼루션 연산

2차원 컨볼루션은 영상 위에 필터를 슬라이드하면서 겹치는 화소와 필터 값의 내적(dot product)을 계산해 특징 맵(feature map)을 만든다. 필터 값을 정하면 원하는 특징이 드러난다. 예를 들어 위아래 행의 차를 계산하는 필터는 수평 에지를, 좌우 열의 차를 계산하는 필터는 수직 에지를 검출한다.

![원 영상에 수평 에지 커널과 수직 에지 커널을 적용해 얻은 두 특징 맵](./images/dl-cnn-transfer-learning-02.jpg '같은 영상이라도 커널에 따라 다른 특징 맵이 나온다')

| 수평 에지 커널 | 수직 에지 커널 |
| -------------- | -------------- |
| (1, 1, 1)      | (−1, 0, 1)     |
| (0, 0, 0)      | (−1, 0, 1)     |
| (−1, −1, −1)   | (−1, 0, 1)     |

컬러 영상은 깊이(채널)가 있는 3차원 텐서이므로 필터도 입력과 같은 깊이를 가진다. 32×32×3 영상에 5×5×3 필터 하나를 적용하면 위치마다 75개 가중치와 75개 화소의 내적에 바이어스를 더한 값 하나가 나오고, 결과는 28×28×1 특징 맵(activation map)이다. 필터가 경계 밖으로 나갈 수 없어서 패딩이 없으면 가로세로가 4씩 줄어든다.

필터 6개를 쓰면 28×28 특징 맵 6장을 쌓아 6×28×28 출력이 된다. 바이어스도 필터마다 하나씩 있으므로 6차원 바이어스 벡터가 함께 학습된다.

![3×32×32 영상이 3×5×5 필터 6개(6×3×5×5)를 쓰는 컨볼루션층을 거쳐 1×28×28 활성 맵 6장, 곧 6×28×28 출력이 되는 그림](./images/dl-cnn-transfer-learning-conv-layer.svg '필터 개수가 출력 채널 수가 된다')

미니배치 단위로 일반화하면 입력은 `N \times C_{in} \times H \times W{:math}`, 필터는 `C_{out} \times C_{in} \times K_h \times K_w{:math}`, 바이어스는 `C_{out}{:math}`차원, 출력은 `N \times C_{out} \times H' \times W'{:math}`이다. N은 한 번에 처리하는 영상 수(배치 크기)다.

### 패딩과 스트라이드

| 하이퍼파라미터           | 역할                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| 패딩(padding, 덧대기)    | 경계 바깥에 값을 덧대 특징 맵이 작아지는 문제를 막는다. 0을 덧대는 제로 패딩을 많이 쓴다       |
| 스트라이드(stride, 보폭) | 필터를 몇 칸씩 옮길지 정한다. 보폭을 k로 하면 특징 맵이 1/k로 줄어든다 (32×32, 보폭 2 → 16×16) |

![입력 4×4·패딩 0·보폭 1, 입력 5×5·패딩 1·보폭 1, 입력 5×5·패딩 1·보폭 2인 세 경우에 3×3 커널이 입력 영상에서 특징 맵을 만드는 그림](./images/dl-cnn-transfer-learning-padding-stride.svg '왼쪽부터 출력 2×2, 5×5, 3×3')

Keras의 `Conv2D(){:python}`는 `padding` 인자로 두 방식을 고른다.

| `padding` | 의미                                                        |
| --------- | ----------------------------------------------------------- |
| `'same'`  | 보폭 1일 때 출력의 가로세로가 입력과 같아지도록 0을 덧댄다  |
| `'valid'` | 패딩 없음. 필터가 영상 안에 완전히 들어가는 위치만 계산한다 |

### 출력 크기와 파라미터 수 계산

입력 크기 N, 필터 크기 F, 패딩 P, 보폭 S일 때 출력 크기는 다음과 같다.

```math
O = \left\lfloor \frac{N + 2P - F}{S} \right\rfloor + 1
```

입력 채널이 `C_{in}{:math}`, 필터 개수가 K일 때 컨볼루션층의 파라미터(가중치와 바이어스) 수는 다음과 같다.

```math
\text{파라미터 수} = (F \times F \times C_{in} + 1) \times K
```

입력 32×32×3에 5×5 필터 10개를 보폭 1, 패딩 2로 적용한다.

| 항목                 | 계산                             | 결과     |
| -------------------- | -------------------------------- | -------- |
| 출력 가로세로        | (32 + 2×2 − 5) / 1 + 1           | 32       |
| 출력 크기            | 32 × 32 × 필터 10개              | 32×32×10 |
| 필터 하나의 파라미터 | 5×5×3 가중치 75개 + 바이어스 1개 | 76       |
| 층 전체 파라미터     | 76 × 10                          | 760      |

패딩 2가 5×5 필터의 경계 손실(4)을 정확히 메우므로 이 층은 `'same'` 패딩과 같다. 그림의 세 경우도 같은 공식으로 확인할 수 있다.

| 입력 | 필터 | 패딩 | 보폭 | 계산                | 출력 |
| ---- | ---- | ---- | ---- | ------------------- | ---- |
| 4×4  | 3×3  | 0    | 1    | (4 − 3) / 1 + 1     | 2×2  |
| 5×5  | 3×3  | 1    | 1    | (5 + 2 − 3) / 1 + 1 | 5×5  |
| 5×5  | 3×3  | 1    | 2    | (5 + 2 − 3) / 2 + 1 | 3×3  |

> [!TIP]
> 보폭 1에서 출력 크기를 입력과 같게 하려면 홀수 필터 F에 대해 `P = (F-1)/2{:math}`로 덧대면 된다. 3×3 필터는 패딩 1, 5×5 필터는 패딩 2, 7×7 필터는 패딩 3이다.

<details>
<summary>출력 크기 공식의 유도</summary>

패딩을 더한 입력의 한 변은 `N + 2P{:math}`칸이다. 필터의 왼쪽 끝이 놓일 수 있는 위치는 0번 칸부터 `N + 2P - F{:math}`번 칸까지이고, 필터는 이 구간을 S칸 간격으로 지난다. 0, S, 2S, …, kS 가운데 `kS \le N + 2P - F{:math}`를 만족하는 가장 큰 k는 `\lfloor (N + 2P - F)/S \rfloor{:math}`이고, 0번 위치를 더하면 출력 크기는 그보다 1 크다.

보폭이 나누어떨어지지 않으면 오른쪽 끝의 남는 칸은 계산에 쓰이지 않는다. 입력 6, 필터 3, 패딩 0, 보폭 2이면 필터 위치는 0, 2이고 (6 − 3) / 2 = 1.5를 내림한 1에 1을 더한 2가 출력 크기다. 5번 칸은 어느 필터 위치에도 들어가지 않는다.

</details>

### 풀링층

CNN은 컨볼루션으로 특징 맵을 추출하는 컨볼루션층과 요약 통계량을 구하는 풀링층으로 구성된다. 풀링(pooling)은 계산량, 메모리 사용량, 파라미터 수를 줄이려고 입력의 부표본(축소본)을 만드는 연산이다.

| 성질   | 내용                                                             |
| ------ | ---------------------------------------------------------------- |
| 효과   | 특징 맵의 지나친 상세함을 줄이고, 특징 맵 크기를 줄인다          |
| 보폭   | 보폭을 s로 하면 특징 맵이 s배 줄어든다 (224×224×64 → 112×112×64) |
| 채널   | 각 특징 맵(채널)에서 독립적으로 작동하므로 깊이는 유지된다       |
| 가중치 | 학습할 가중치가 없다                                             |
| 종류   | 커널 안의 최댓값을 취하는 최대 풀링, 평균값을 취하는 평균 풀링   |

![채널 하나의 4×4 특징 맵에 2×2 최대 풀링(보폭 2)을 적용해 2×2 맵 6, 8, 3, 4를 얻는 예](./images/dl-cnn-transfer-learning-max-pool.svg '구역마다 가장 큰 값만 남는다')

평균 풀링은 구역마다 평균값을 취한다. 다음 4×4 특징 맵에 2×2 평균 풀링(보폭 2)을 적용한다.

```math
\begin{pmatrix} 31 & 15 & 28 & 184 \\ 0 & 100 & 70 & 38 \\ 12 & 12 & 7 & 2 \\ 12 & 12 & 45 & 6 \end{pmatrix}
\;\rightarrow\;
\begin{pmatrix} 36.5 & 80 \\ 12 & 15 \end{pmatrix}
```

| 구역        | 계산                     | 평균 |
| ----------- | ------------------------ | ---- |
| 왼쪽 위     | (31 + 15 + 0 + 100) / 4  | 36.5 |
| 오른쪽 위   | (28 + 184 + 70 + 38) / 4 | 80   |
| 왼쪽 아래   | (12 × 4) / 4             | 12   |
| 오른쪽 아래 | (7 + 2 + 45 + 6) / 4     | 15   |

### 부분 연결성과 가중치 공유

| 성질                            | 내용                                                                   |
| ------------------------------- | ---------------------------------------------------------------------- |
| 부분 연결성(partial connection) | 필터는 해당 화소 주위에 국한해 연산한다                                |
| 가중치 공유(weight sharing)     | 입력 특징 맵의 모든 화소가 같은 필터를 쓰므로 가중치를 공유하는 셈이다 |

k 채널 입력에 h×h×k 필터 k′개를 쓰는 층의 가중치 수는 영상 크기와 무관하다.

```math
k'(kh^2 + 1)
```

==가중치 공유 덕분에 학습으로 알아내야 할 매개변수가 대폭 줄어 학습이 빨라진다.== 앞의 32×32×3 예에서 FC층으로 32×32×10 출력을 만들면 (3072 + 1) × 10240 ≈ 3,147만 개가 필요하지만 컨볼루션층은 760개로 충분하다.

## 빌딩블록을 쌓아 만드는 CNN

ConvNet은 활성화 함수(ReLU)를 포함한 컨볼루션층의 연속이다. 32×32×3 입력에 5×5×3 필터 6개를 쓰면 28×28×6이 되고, 다시 5×5×6 필터 10개를 쓰면 24×24×10이 된다. 다음 층 필터의 깊이는 앞 층의 채널 수(6)와 같아야 한다.

![32×32×3 입력이 5×5×3 필터 6개의 컨볼루션·ReLU로 28×28×6, 다시 5×5×6 필터 10개로 24×24×10이 되는 연속](./images/dl-cnn-transfer-learning-conv-relu-stack.svg '층을 지날수록 공간 크기는 줄고 채널은 늘어난다')

보통 컨볼루션층(C)과 풀링층(P)을 번갈아 쌓는다. 풀링층에서는 텐서 깊이가 유지되고, 신경망 앞부분은 특징 추출을, Flatten과 FC층으로 이어지는 뒷부분은 분류를 담당한다. 특징이 충분히 뽑힌 뒤에는 더 이상 공간 정보를 유지할 필요가 없으므로 Flatten으로 1차원으로 바꾼다.

![C와 P를 번갈아 쌓은 특징 추출부와 각 층의 커널 크기 h, 개수 k, 보폭 s, 덧대기 p 표기](./images/dl-cnn-transfer-learning-08.jpg 'CNN의 전형적인 구조')

### LeNet-5

LeNet-5([LeCun 1998](https://doi.org/10.1109/5.726791))는 수표와 문서의 필기 숫자를 인식하려고 만든 C-P-C-P-C-FC-FC 구조다. 층마다 가중치 수를 계산하면 다음과 같다.

| 층         | 출력     | 가중치 계산        | 가중치 수 |
| ---------- | -------- | ------------------ | --------- |
| C1         | 28×28×6  | (5×5×1 + 1) × 6    | 156       |
| P (2×2, 2) | 14×14×6  | 없음               | 0         |
| C2         | 10×10×16 | (5×5×6 + 1) × 16   | 2,416     |
| P (2×2, 2) | 5×5×16   | 없음               | 0         |
| C3         | 1×1×120  | (5×5×16 + 1) × 120 | 48,120    |
| FC1        | 84       | (120 + 1) × 84     | 10,164    |
| FC2        | 10       | (84 + 1) × 10      | 850       |
| 합계       |          |                    | 61,706    |

![LeCun 논문의 LeNet-5 그림과 C·P·FC 표기로 다시 그린 그림](./images/dl-cnn-transfer-learning-09.jpg '32×32 입력이 120차원 벡터를 거쳐 10부류 출력이 된다')

### 유연한 구조

빌딩블록은 문제에 따라 다양한 모양으로 조립할 수 있다. 입력과 출력이 같은 오토인코더(비지도 학습)는 인코더로 압축한 특징 맵을 디코더로 다시 복원하고, 분할을 위한 신경망은 영상 크기의 분할 맵을 출력한다. 분할 신경망은 [의미 분할의 성능 평가와 FCN·DeconvNet·U-Net](/memo/dl-segmentation)에서 U-Net과 함께 다룬다.

## CNN의 학습

CNN도 MLP처럼 역전파 알고리즘으로 학습한다. ① 전방 계산으로 예측 o를 구하고, ② 참값 y와 비교해 손실 함수를 계산하고, ③ 역전파로 가중치를 갱신한다. 컨볼루션층의 커널 화소와 FC층의 에지가 가중치에 해당하고, 풀링층에는 가중치가 없다.

![C·P층과 FC층으로 이어진 CNN에서 전방 계산, 손실 함수 계산, 역전파가 진행되는 방향](./images/dl-cnn-transfer-learning-10.jpg '커널 U¹, U², …와 FC 가중치가 역전파로 갱신된다')

### 특징 학습과 통째 학습

특징 학습(feature learning)은 학습 알고리즘이 주어진 데이터셋을 인식하는 데 최적인 필터를 알아내는 방식이다. CIFAR-10으로 학습한 CNN의 첫 컨볼루션층 필터 32개(채널 3개씩)를 출력하면 사람이 설계하지 않은 다양한 패턴이 나온다.

![CIFAR-10으로 학습한 conv2d_4 층의 3×3 커널 32개를 채널별로 출력한 격자](./images/dl-cnn-transfer-learning-11.jpg '필터 값은 사람이 정하지 않고 학습으로 정해진다')

통째 학습(end-to-end learning)은 특징 학습과 분류기 학습을 한꺼번에 진행한다. 고전적 패러다임은 수작업으로 특징을 추출하고 분류기만 학습했지만, 딥러닝 패러다임은 영상에서 부류까지 전 과정을 학습한다.

> [!IMPORTANT] CNN이 우수한 이유
>
> - 데이터의 원래 구조를 유지한다.
> - 특징 학습으로 최적의 특징을 추출한다.
> - 신경망의 깊이를 깊게 할 수 있다.

## LeNet-5 재현

Keras로 LeNet-5를 만들어 MNIST를 인식한다. MNIST는 28×28이므로 첫 층에 `padding='same'`을 써서 28×28×6을 유지하고, 이후 층은 원 논문처럼 크기가 줄어든다.

```python
import numpy as np
import tensorflow as tf
import tensorflow.keras.datasets as ds

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dropout, Dense
from tensorflow.keras.optimizers import Adam

(x_train, y_train), (x_test, y_test) = ds.mnist.load_data()
x_train = x_train.reshape(60000, 28, 28, 1)  # 2차원 구조로 변환
x_test = x_test.reshape(10000, 28, 28, 1)
x_train = x_train.astype(np.float32) / 255.0
x_test = x_test.astype(np.float32) / 255.0
y_train = tf.keras.utils.to_categorical(y_train, 10)
y_test = tf.keras.utils.to_categorical(y_test, 10)

cnn = Sequential()
cnn.add(Conv2D(6, (5, 5), padding='same', activation='relu', input_shape=(28, 28, 1)))
cnn.add(MaxPooling2D(pool_size=(2, 2), strides=2))
cnn.add(Conv2D(16, (5, 5), padding='valid', activation='relu'))
cnn.add(MaxPooling2D(pool_size=(2, 2), strides=2))
cnn.add(Conv2D(120, (5, 5), padding='valid', activation='relu'))
cnn.add(Flatten())  # 1차원 구조로 변환
cnn.add(Dense(units=84, activation='relu'))
cnn.add(Dense(units=10, activation='softmax'))

cnn.compile(loss='categorical_crossentropy', optimizer=Adam(learning_rate=0.001), metrics=['accuracy'])
cnn.fit(x_train, y_train, batch_size=128, epochs=30, validation_data=(x_test, y_test), verbose=2)

res = cnn.evaluate(x_test, y_test, verbose=0)
print('정확률=', res[1] * 100)
```

| 줄                                     | 역할                                              |
| -------------------------------------- | ------------------------------------------------- |
| `reshape(60000, 28, 28, 1)`            | MLP용 784차원 벡터가 아니라 28×28×1 텐서로 넣는다 |
| `to_categorical(y, 10)`                | 레이블을 원핫 코드로 바꾼다                       |
| `Conv2D(6, (5, 5), padding='same')`    | 5×5 커널 6개, 출력 28×28×6                        |
| `Conv2D(120, (5, 5), padding='valid')` | 5×5×16 입력을 1×1×120으로 만든다                  |
| `Flatten()`                            | 1×1×120을 120차원 벡터로 바꿔 FC층에 넘긴다       |

30세대 학습 뒤 테스트 정확률은 99.10%로, 같은 MNIST로 학습한 깊은 MLP보다 0.68%p 높다. 미니배치 128개로 60,000장을 나누면 469번(468.75를 올림) 갱신이 한 세대다.

오분류 데이터는 `predict(){:python}`가 낸 확률 벡터에 `argmax(axis=-1){:python}`를 적용해 찾는다. argmax는 배열에서 최댓값의 인덱스를 돌려주므로 (0, 0, 0, 0.01, 0.05, 0.94, 0, 0, 0, 0)이면 5다. 예측과 정답의 argmax가 다른 영상이 오분류이고, 사람이 보기에도 헷갈리는 4를 2로, 6을 0으로 예측한 경우가 나온다.

```python
y_prob = cnn.predict(x_test)
predicted = y_prob.argmax(axis=-1)
for i in range(313):
    if predicted[i] != np.argmax(y_test[i]):
        ...  # 영상과 예측 부류를 출력
```

## 자연 영상 인식

딥러닝에서 주로 쓰는 자연 영상 데이터베이스는 [ImageNet](https://doi.org/10.1109/CVPR.2009.5206848), [MS COCO](https://cocodataset.org/), CIFAR다. CIFAR는 영상이 작아서 MNIST 다음 단계로 자주 쓴다. CIFAR-10은 airplane, automobile, bird, cat, deer, dog, frog, horse, ship, truck 10부류이고 영상은 32×32 컬러 영상이다.

다음 모델은 3×3 컨볼루션 두 번과 최대 풀링을 한 블록으로 두 번 쌓고, 규제 기법인 드롭아웃을 넣는다.

```python
(x_train, y_train), (x_test, y_test) = ds.cifar10.load_data()
x_train = x_train.astype(np.float32) / 255.0
x_test = x_test.astype(np.float32) / 255.0
y_train = tf.keras.utils.to_categorical(y_train, 10)
y_test = tf.keras.utils.to_categorical(y_test, 10)

cnn = Sequential()
cnn.add(Conv2D(32, (3, 3), activation='relu', input_shape=(32, 32, 3)))
cnn.add(Conv2D(32, (3, 3), activation='relu'))
cnn.add(MaxPooling2D(pool_size=(2, 2)))
cnn.add(Dropout(0.25))  # 규제 기법인 드롭아웃 적용
cnn.add(Conv2D(64, (3, 3), activation='relu'))
cnn.add(Conv2D(64, (3, 3), activation='relu'))
cnn.add(MaxPooling2D(pool_size=(2, 2)))
cnn.add(Dropout(0.25))
cnn.add(Flatten())
cnn.add(Dense(units=512, activation='relu'))
cnn.add(Dropout(0.5))
cnn.add(Dense(units=10, activation='softmax'))

cnn.compile(loss='categorical_crossentropy', optimizer=Adam(learning_rate=0.001), metrics=['accuracy'])
hist = cnn.fit(x_train, y_train, batch_size=128, epochs=100, validation_data=(x_test, y_test), verbose=2)

res = cnn.evaluate(x_test, y_test, verbose=0)
print('정확률=', res[1] * 100)

import matplotlib.pyplot as plt

plt.plot(hist.history['accuracy'])
plt.plot(hist.history['val_accuracy'])
plt.title('Accuracy graph')
plt.legend(['Train', 'Validation'])
plt.show()
```

`padding`을 지정하지 않으면 기본값 `'valid'`이므로 층마다 크기가 줄어든다. 출력 크기와 파라미터 수는 다음과 같다.

| 층             | 출력     | 파라미터 계산     | 파라미터 수 |
| -------------- | -------- | ----------------- | ----------- |
| Conv2D 32, 3×3 | 30×30×32 | (3×3×3 + 1) × 32  | 896         |
| Conv2D 32, 3×3 | 28×28×32 | (3×3×32 + 1) × 32 | 9,248       |
| MaxPooling 2×2 | 14×14×32 |                   | 0           |
| Conv2D 64, 3×3 | 12×12×64 | (3×3×32 + 1) × 64 | 18,496      |
| Conv2D 64, 3×3 | 10×10×64 | (3×3×64 + 1) × 64 | 36,928      |
| MaxPooling 2×2 | 5×5×64   |                   | 0           |
| Flatten        | 1600     |                   | 0           |
| Dense 512      | 512      | (1600 + 1) × 512  | 819,712     |
| Dense 10       | 10       | (512 + 1) × 10    | 5,130       |
| 합계           |          |                   | 890,410     |

> [!NOTE]
> 전체 파라미터의 92%가 Flatten 뒤 첫 Dense층에 몰려 있다. 컨볼루션층은 가중치를 공유하므로 채널이 늘어도 파라미터가 적고, FC층은 입력 차원과 출력 차원의 곱만큼 파라미터가 필요하다.

100세대 뒤 테스트 정확률은 81.40%로, 같은 CIFAR-10으로 학습한 깊은 MLP보다 26.24%p 높다. 50,000장을 128개씩 나누면 한 세대는 391번 갱신이다.

![CIFAR-10 학습의 세대별 정확률 그래프와 손실 그래프](./images/dl-cnn-transfer-learning-12.jpg '훈련 정확률은 계속 오르지만 검증 손실은 20세대 무렵부터 다시 오른다')

그래프에서 훈련 정확률은 0.92까지 오르지만 검증 정확률은 0.8 근처에서 멈추고, 검증 손실은 20세대 무렵 최저점을 찍은 뒤 다시 오른다. 과잉 적합이 시작된 신호이고, 뒤의 규제 기법과 조기 멈춤이 이 문제를 다룬다. 오분류 영상을 출력하면 개를 고양이로, 사슴을 말로 예측하는 등 32×32 해상도에서 사람도 헷갈리는 경우가 많다.

### 드롭아웃

드롭아웃(dropout)은 뉴런을 임의로 삭제하면서 학습하는 규제 기법이다([Srivastava 외, 2014](https://jmlr.org/papers/v15/srivastava14a.html)).

- 훈련 시각에는 데이터를 흘릴 때마다 은닉층 뉴런을 무작위로 골라 삭제한다.
- 삭제된 뉴런은 신호를 전달하지 않는다.
- 테스트 시각에는 모든 뉴런에 신호를 전달한다.

![모든 뉴런이 연결된 표준 신경망과 일부 뉴런을 X로 삭제한 드롭아웃 신경망](./images/dl-cnn-transfer-learning-dropout.svg 'X 표시 뉴런은 이번 미니배치에서 신호를 전달하지 않는다')

`Dropout(0.25){:python}`는 앞 층 출력의 25%를 0으로 만든다. Keras는 훈련 시각에 남은 출력을 1/(1−rate)배 키워 기댓값을 맞추므로 테스트 시각에는 별도 보정 없이 모든 뉴런을 쓴다.

## 텐서플로 프로그래밍

텐서플로(Keras) 프로그래밍의 핵심은 네 가지 모듈이다.

| 모듈         | 역할       | 예                                                                            |
| ------------ | ---------- | ----------------------------------------------------------------------------- |
| `models`     | 모델 생성  | `Sequential`, Functional API(`Model`)                                         |
| `layers`     | 층 쌓기    | 완전연결층 `Dense`, 컨볼루션층 `Conv2D`, `MaxPooling2D`                       |
| `losses`     | 손실 함수  | 평균제곱오차 MSE, 교차 엔트로피 `categorical_crossentropy`, 분할을 위한 focal |
| `optimizers` | 옵티마이저 | SGD, Adam, AdaGrad, RMSprop                                                   |

Sequential은 텐서가 한 갈래로 끝까지 흐르는 경우에 쓰고, Functional API는 텐서가 여러 갈래로 나뉘는 경우에 쓴다. 같은 모델을 두 방식으로 쓰면 다음과 같다.

```python
# Sequential
model = Sequential()
model.add(Conv2D(32, (3, 3), input_shape=(32, 32, 3)))
model.add(Conv2D(64, (3, 3)))
model.add(Flatten())
model.add(Dense(10, activation='softmax'))

# Functional API
from tensorflow.keras.layers import Input
from tensorflow.keras.models import Model

input = Input(shape=(32, 32, 3))
x1 = Conv2D(32, (3, 3))(input)
x2 = Conv2D(64, (3, 3))(x1)
x3 = Flatten()(x2)
output = Dense(10, activation='softmax')(x3)
model = Model(input, output)
```

Keras 2 이후 `Conv2D()`의 세 번째 위치 인자는 `strides`이므로 커널 크기는 `(3, 3)` 튜플로 넘긴다.

## 손실 함수

신경망 초기에는 평균제곱오차(MSE)를 주로 썼다. M은 미니배치, y는 참값, o는 예측이다.

```math
J(\mathbf{W}) = \frac{1}{|M|} \sum_{\mathbf{x} \in M} \lVert \mathbf{y} - \mathbf{o} \rVert_2^2
```

딥러닝에서는 분류에 교차 엔트로피를 주로 쓰고, 물체 검출·분할·추적처럼 과업에 맞춘 손실 함수를 따로 설계한다.

### 엔트로피와 교차 엔트로피

엔트로피(entropy)는 확률 분포의 무작위성(불확실성)을 측정하는 함수다. 공정한 주사위의 엔트로피는 1이 나올 확률이 큰 찌그러진 주사위보다 높다.

```math
H(x) = -\sum_{i=1}^{k} P(e_i) \log P(e_i)
```

교차 엔트로피(cross entropy)는 두 확률 분포 P와 Q가 다른 정도를 측정한다.

```math
H(P, Q) = -\sum_{i=1}^{k} P(e_i) \log Q(e_i)
```

자연로그로 계산하면 다음과 같다.

| P             | Q                               | 교차 엔트로피 계산                                                 | 값     |
| ------------- | ------------------------------- | ------------------------------------------------------------------ | ------ |
| 공정한 주사위 | 공정한 주사위                   | `-6 \cdot \frac{1}{6}\log\frac{1}{6} = \log 6{:math}`              | 1.7918 |
| 공정한 주사위 | 1이 1/2, 나머지가 1/10인 주사위 | `-\frac{1}{6}\log\frac{1}{2} - \frac{5}{6}\log\frac{1}{10}{:math}` | 2.0343 |

두 분포가 다를수록 교차 엔트로피가 커지고, P = Q이면 P의 엔트로피와 같아진다.

### MSE와 교차 엔트로피 비교

참값이 y = (0, 1, 0, 0, 0)인 샘플 하나에 대해, 예측이 참값에 가까운 상황 ①과 벗어난 상황 ②의 손실을 계산하면 다음과 같다. MSE는 샘플 하나의 제곱 오차 합으로 계산한다.

| 상황 | 예측 o                    | 제곱 오차 합                         | 교차 엔트로피     |
| ---- | ------------------------- | ------------------------------------ | ----------------- |
| ①    | (0.1, 0.6, 0.2, 0.0, 0.1) | 0.01 + 0.16 + 0.04 + 0 + 0.01 = 0.22 | −log 0.6 = 0.5108 |
| ②    | (0.1, 0.2, 0.6, 0.0, 0.1) | 0.01 + 0.64 + 0.36 + 0 + 0.01 = 1.02 | −log 0.2 = 1.6094 |

원핫 참값에서는 정답 부류 항만 남으므로 교차 엔트로피는 정답 부류 확률의 음의 로그다. ==교차 엔트로피는 정답 확률이 0에 가까워질수록 손실이 급격히 커져서 틀린 예측을 더 강하게 벌한다.==

### Focal 손실

Focal 손실은 부류 불균형이 심한 경우에 효과적이다. Lin 외의 RetinaNet 논문([Focal Loss for Dense Object Detection, 2017](https://arxiv.org/abs/1708.02002))이 물체 검출에서 배경 박스가 압도적으로 많은 문제를 풀려고 제안했고, 이후 의료 영상 분할처럼 불균형이 심한 과업에 널리 쓰인다.

부류가 물체와 배경 둘인 화소에서 예측을 o = (p, 1−p)라 하면, 참값 부류의 확률 `p_t{:math}`와 교차 엔트로피, Focal 손실은 다음과 같다.

```math
p_t = \begin{cases} p & \text{참값이 물체인 화소} \\ 1 - p & \text{참값이 배경인 화소} \end{cases}
\qquad
e_{CE} = -\log(p_t)
\qquad
e_{FL} = -(1 - p_t)^{\gamma} \log(p_t)
```

![p_t에 따른 교차 엔트로피와 γ = 0, 0.5, 1, 2, 5인 Focal 손실 곡선](./images/dl-cnn-transfer-learning-14.jpg 'γ가 클수록 잘 맞힌 샘플(p_t가 큰 쪽)의 손실이 빠르게 0에 가까워진다')

`(1 - p_t)^{\gamma}{:math}` 항은 이미 잘 맞힌 쉬운 샘플의 손실을 깎아 어려운 샘플에 학습을 집중시킨다. γ = 0이면 교차 엔트로피와 같다.

## 옵티마이저

최적화(optimization)는 손실 함수의 최저점, 즉 오류가 최저인 점을 찾아가는 과정이고, 오류 역전파 과정 중에 가중치를 갱신하면서 진행한다. 학습률(learning rate)은 한 스텝마다 이동하는 발자국의 크기이고, 그레이디언트(gradient)는 이동할 방향이다.

```math
\mathbf{a}^{n+1} = \mathbf{a}^{n} - \gamma \nabla F(\mathbf{a}^{n})
```

마이너스는 에러를 낮추는 방향, γ는 학습률, `\nabla F(\mathbf{a}^n){:math}`는 현 지점의 기울기다.

### 모멘텀과 적응적 학습률

| 기법             | 아이디어                                                                                       | Keras 기본값                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 모멘텀(momentum) | 이전 운동량이 현재에 영향을 미치는 물리 법칙처럼, 가중치 변경 이력이 현재 갱신에 영향을 미친다 | `SGD(learning_rate=0.01, momentum=0.0, nesterov=False)`       |
| Adagrad          | 많이 갱신된 가중치일수록 학습률을 줄인다                                                       | `Adagrad(learning_rate=0.001, initial_accumulator_value=0.1)` |
| RMSprop          | 과거 그레이디언트 제곱을 지수 이동 평균으로 반영한다                                           | `RMSprop(learning_rate=0.001, rho=0.9)`                       |
| Adam             | RMSprop에 모멘텀을 결합한다                                                                    | `Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999)`         |

Adagrad, RMSprop, Adam처럼 가중치마다 학습률을 따로 조정하는 방식을 적응적 학습률(adaptive learning rate)이라 한다. 모멘텀의 갱신식은 속도 v에 이전 값을 α만큼 남긴다.

```math
\mathbf{v} \leftarrow \alpha \mathbf{v} - \eta \nabla J(\mathbf{w}), \qquad \mathbf{w} \leftarrow \mathbf{w} + \mathbf{v}
```

![GD에서 SGD, Momentum, NAG, Adagrad, RMSProp, AdaDelta, Adam, Nadam으로 이어지는 옵티마이저 계보](./images/dl-cnn-transfer-learning-15.jpg '위쪽 갈래는 스텝 방향을, 아래쪽 갈래는 스텝 크기를 개선한다')

| 옵티마이저 | 개선 방향 | 요약                                                        |
| ---------- | --------- | ----------------------------------------------------------- |
| GD         |           | 모든 데이터로 기울기를 계산해 방향을 정한다                 |
| SGD        |           | 미니배치만 보고 빨리 판단해 같은 시간에 더 많이 간다        |
| Momentum   | 방향      | 계산한 스텝으로 움직인 뒤 내려오던 관성 방향으로 더 간다    |
| NAG        | 방향      | 관성 방향으로 먼저 움직이고 그 자리에서 스텝을 계산한다     |
| Adagrad    | 크기      | 안 가본 곳은 빠르게, 많이 가본 곳은 보폭을 줄여 세밀히 탐색 |
| RMSProp    | 크기      | 보폭을 줄이되 이전 맥락을 반영한다                          |
| AdaDelta   | 크기      | 보폭이 너무 작아져 멈추는 문제를 막는다                     |
| Adam       | 둘 다     | RMSProp + Momentum                                          |
| Nadam      | 둘 다     | Adam에 Momentum 대신 NAG를 붙인다                           |

## 규제

과잉 적합(overfitting)은 추정할 가중치는 많은데 데이터가 부족한 경우에 발생한다. 다항식 차수를 1, 2, 3, 12로 올리면 1·2차는 과소 적합, 12차는 샘플만 지나는 과잉 적합이 된다. 12차 모델이라도 샘플을 20, 30, 50, 100개로 늘리면 참 함수에 가까워진다.

![차수 1, 2, 3, 12의 다항식 회귀와, 12차 모델에서 샘플 수를 20·30·50·100으로 늘린 결과](./images/dl-cnn-transfer-learning-16.jpg '데이터가 많아지면 같은 모델도 과잉 적합이 줄어든다')

| 규제 기법                 | 방법                                              |
| ------------------------- | ------------------------------------------------- |
| 데이터 증강               | 회전, 이동, 반전 등으로 훈련 샘플을 늘린다        |
| 드롭아웃                  | 훈련 시각에 뉴런을 무작위로 삭제한다              |
| 조기 멈춤(early stopping) | 검증 성능이 더 나아지지 않는 시각에 학습을 멈춘다 |

## 대표 CNN 모델

ImageNet 대회(ILSVRC; [ImageNet Large Scale Visual Recognition Challenge](https://arxiv.org/abs/1409.0575))의 top-5 오류율 추이는 CNN 구조의 발전사와 겹친다.

![2010년부터 2017년까지 ILSVRC 우승 모델의 top-5 오류율과 층 수(얕은 모델, 8층, 19층, 22층, 152층), 사람의 오류율 5.1%](./images/dl-cnn-transfer-learning-ilsvrc.svg '2012년 AlexNet이 첫 CNN 우승 모델이다')

| 연도 | 모델              | 층 수   | top-5 오류율 | 핵심                        |
| ---- | ----------------- | ------- | ------------ | --------------------------- |
| 2010 | Lin 외            | shallow | 28.2%        | 수작업 특징                 |
| 2011 | Sanchez·Perronnin | shallow | 25.8%        | 수작업 특징                 |
| 2012 | AlexNet           | 8       | 16.4%        | 첫 CNN 우승                 |
| 2013 | ZFNet             | 8       | 11.7%        | AlexNet 하이퍼파라미터 개선 |
| 2014 | VGG               | 19      | 7.3%         | 작은 필터, 깊은 신경망      |
| 2014 | GoogLeNet         | 22      | 6.7%         | 인셉션 모듈                 |
| 2015 | ResNet            | 152     | 3.6%         | 잔차 연결, 깊이의 혁명      |
| 2016 | Shao 외           | 152     | 3.0%         | 앙상블                      |
| 2017 | SENet             | 154     | 2.3%         | 특징 맵 재가중              |
| 기준 | 사람              |         | 5.1%         |                             |

> [!NOTE]
> 2014년 분류 부문 우승은 GoogLeNet(6.7%)이고, VGG(7.3%)는 분류 부문 2위였다. VGG는 같은 해 위치 추정(localization) 부문에서 우승했다.

### AlexNet

AlexNet([Krizhevsky 외, 2012](https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html))은 컨볼루션층 5개와 FC층 3개로 이루어진 8층 신경망이다. 원 논문은 GPU 두 대에 층을 나눠 학습했기 때문에 그림이 위아래 두 갈래다.

![GPU 두 대로 나뉜 AlexNet 구조도](./images/dl-cnn-transfer-learning-18.jpg 'CONV1-POOL1-NORM1-CONV2-POOL2-NORM2-CONV3-CONV4-CONV5-POOL3-FC6-FC7-FC8')

입력이 227×227×3일 때 첫 두 층의 출력 크기와 파라미터 수를 공식으로 구하면 다음과 같다.

| 질문                                     | 계산                    | 답              |
| ---------------------------------------- | ----------------------- | --------------- |
| CONV1(11×11 필터 96개, 보폭 4) 출력 크기 | (227 − 11) / 4 + 1 = 55 | 55×55×96        |
| CONV1 파라미터 수                        | (11×11×3 + 1) × 96      | 34,944 (약 35K) |
| POOL1(3×3, 보폭 2) 출력 크기             | (55 − 3) / 2 + 1 = 27   | 27×27×96        |
| POOL1 파라미터 수                        | 풀링은 가중치가 없다    | 0               |

전체 구조를 같은 방법으로 계산하면 다음과 같다. 파라미터 수는 GPU 분할을 무시한 단순화 구조 기준이다.

| 층        | 설정                       | 출력      | 파라미터 수 |
| --------- | -------------------------- | --------- | ----------- |
| INPUT     |                            | 227×227×3 |             |
| CONV1     | 11×11 96개, 보폭 4, 패딩 0 | 55×55×96  | 34,944      |
| MAX POOL1 | 3×3, 보폭 2                | 27×27×96  | 0           |
| NORM1     | 정규화층                   | 27×27×96  | 0           |
| CONV2     | 5×5 256개, 보폭 1, 패딩 2  | 27×27×256 | 614,656     |
| MAX POOL2 | 3×3, 보폭 2                | 13×13×256 | 0           |
| NORM2     | 정규화층                   | 13×13×256 | 0           |
| CONV3     | 3×3 384개, 보폭 1, 패딩 1  | 13×13×384 | 885,120     |
| CONV4     | 3×3 384개, 보폭 1, 패딩 1  | 13×13×384 | 1,327,488   |
| CONV5     | 3×3 256개, 보폭 1, 패딩 1  | 13×13×256 | 884,992     |
| MAX POOL3 | 3×3, 보폭 2                | 6×6×256   | 0           |
| FC6       | 4096개 뉴런                | 4096      | 37,752,832  |
| FC7       | 4096개 뉴런                | 4096      | 16,781,312  |
| FC8       | 1000개 뉴런(부류 점수)     | 1000      | 4,097,000   |
| 합계      |                            |           | 62,378,344  |

> [!NOTE]
> 파라미터 62,378,344개 가운데 약 94%(58,631,144개)가 FC6~FC8에 있다.

### ZFNet

ZFNet([Zeiler·Fergus, 2013](https://arxiv.org/abs/1311.2901))은 AlexNet의 하이퍼파라미터를 개선했다. CONV1의 필터를 줄이고 보폭을 좁혀 첫 층이 더 촘촘하게 특징을 잡도록 했고, CONV3·4·5의 필터 수를 늘린 구성도 있다.

| 항목                  | AlexNet       | ZFNet          |
| --------------------- | ------------- | -------------- |
| CONV1                 | 11×11, 보폭 4 | 7×7, 보폭 2    |
| CONV3·4·5 필터 수     | 384, 384, 256 | 512, 1024, 512 |
| ImageNet top-5 오류율 | 16.4%         | 11.7%          |

![224 입력에 7×7 보폭 2 필터를 쓰고, 층마다 풀링·대비 정규화를 거쳐 4096 유닛 두 층과 C개 부류 softmax 출력으로 이어지는 ZFNet의 층별 구조](./images/dl-cnn-transfer-learning-zfnet.svg '입력 224 → 110 → 55 → 26 → 13 → 13 → 13 → 6으로 줄어든다')

ZFNet 논문은 디컨볼루션 신경망으로 중간층 특징 맵을 입력 공간에 투영해 CNN 내부를 시각화한 연구로도 알려져 있다.

### VGGNet

VGGNet([Simonyan·Zisserman, 2014](https://arxiv.org/abs/1409.1556))은 작은 필터로 깊은 신경망을 만든다. 3×3 CONV(보폭 1, 패딩 1)과 2×2 MAX POOL(보폭 2)만 쓰고, 층 수를 AlexNet의 8에서 16(VGG16)·19(VGG19)로 늘려 top-5 오류율을 ZFNet의 11.7%에서 7.3%로 낮췄다.

작은 필터를 쓰는 이유는 3×3 컨볼루션(보폭 1) 3층의 유효 수용장(effective receptive field)이 7×7 컨볼루션 1층과 같기 때문이다. 층마다 수용장이 2씩 넓어져 3 → 5 → 7이 된다.

![3×3 컨볼루션 세 번을 거친 A3의 화소 1개가 A2의 3×3, A1의 5×5, 입력의 7×7 영역을 보는 그림](./images/dl-cnn-transfer-learning-receptive-field.svg 'A1은 3×3, A2는 5×5, A3는 7×7 입력 영역에 반응한다')

같은 수용장에서 3×3 세 층은 비선형(ReLU)이 세 번 들어가 더 깊고, 층마다 채널이 C개일 때 파라미터도 적다(바이어스 제외).

```math
3 \times (3^2 C^2) = 27C^2 \quad < \quad 7^2 C^2 = 49C^2
```

### GoogLeNet

GoogLeNet([Szegedy 외, 2014](https://arxiv.org/abs/1409.4842))은 22층 신경망이지만 계산 효율을 높여 파라미터가 약 500만 개뿐이다. AlexNet보다 12배, VGG-16보다 27배 적다.

| 특징            | 내용                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| 인셉션 모듈 9개 | 1×1, 3×3, 5×5 컨볼루션과 3×3 최대 풀링을 병렬로 적용하고 결과를 채널 방향으로 결합한다 |
| 1×1 컨볼루션    | 공간 정보는 보존하면서 채널 수만 줄여 계산량을 낮춘다(특징 맵의 결합)                  |
| FC층 미사용     | 마지막 특징 맵마다 전역 평균 풀링(GAP)을 적용한다                                      |
| 보조 분류기     | 중간층에 보조 분류기 2개를 달아 그레이디언트 소멸을 완화한다                           |

GoogLeNet은 InceptionNet이라고도 부른다. 여러 스케일의 컨볼루션을 동시에 적용해 다양한 크기의 특징을 효율적으로 뽑는다.

![이전 층에서 1×1·3×3·5×5 컨볼루션과 3×3 최대 풀링을 병렬로 거쳐 필터를 연결하는 기본 인셉션 모듈과, 1×1 컨볼루션으로 차원을 줄인 인셉션 모듈](./images/dl-cnn-transfer-learning-inception.svg '1×1 컨볼루션을 3×3·5×5 앞과 풀링 뒤에 넣어 채널을 줄인다')

> [!TIP]
> 28×28×192 입력에 5×5 컨볼루션 32개를 적용하는 곱셈 수를 비교하면 1×1 컨볼루션의 효과가 드러난다.
>
> | 방식                                        | 곱셈 수 계산                   | 곱셈 수    |
> | ------------------------------------------- | ------------------------------ | ---------- |
> | 5×5 32개를 바로 적용                        | 28·28·32·5·5·192               | 약 1.2억   |
> | 1×1 16개로 채널을 192 → 16으로 줄인 뒤 적용 | 28·28·16·192 + 28·28·32·5·5·16 | 약 1,240만 |
>
> 곱셈 수가 약 10분의 1이 된다.

### ResNet

ResNet([He 외, 2015](https://arxiv.org/abs/1512.03385))은 잔차 연결(residual connection)로 152층까지 쌓은 신경망이고, 2015년 ILSVRC와 COCO의 분류·검출 대회에서 모두 우승했다. 잔차 연결은 스킵 연결(skip connection)이라고도 하며, 입력을 출력에 더해 준다.

```math
H(x) = F(x) + x
```

![컨볼루션 두 층의 출력 F(x)에 항등 연결로 건너온 입력 x를 더해 F(x) + x를 만드는 잔차 블록](./images/dl-cnn-transfer-learning-residual-block.svg '층은 H(x) 전체가 아니라 잔차 F(x)만 학습한다')

컨볼루션층과 FC층만으로 쌓은 평범한(plain) 신경망은 34층이 18층보다 훈련 오류도 테스트 오류도 높았다. 과잉 적합이 아니라 깊은 신경망의 최적화가 어려운 퇴화(degradation) 문제다. ==잔차 연결을 넣은 ResNet은 34층이 18층보다 오류가 낮아, 망이 깊어질수록 오류가 작아진다.==

![plain-18과 plain-34, ResNet-18과 ResNet-34의 학습 반복에 따른 오류율 곡선](./images/dl-cnn-transfer-learning-23.jpg 'plain은 34층이 더 나쁘고 ResNet은 34층이 더 좋다')

### SENet

SENet(Squeeze-and-Excitation Networks, [Hu 외, 2017](https://arxiv.org/abs/1709.01507))은 특징 맵의 채널마다 가중치를 계산해 다시 곱하는 방식(reweighting feature map)으로 2017년 ILSVRC에서 top-5 오류율 2.3%를 기록했다.

| 단계       | 연산                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Squeeze    | 채널별 가중치를 계산하려고 H×W×C 특징 맵에 전역 평균 풀링을 적용해 1×1×C로 만든다                  |
| Excitation | FC로 채널 수를 C/r로 축소했다가 ReLU 뒤 FC로 C로 되돌리고 sigmoid를 적용해 채널 간 관계를 반영한다 |
| Scale      | 0~1의 채널 가중치를 원래 특징 맵의 각 채널에 곱한다                                                |

```math
\mathbf{s} = \sigma\left(\mathbf{W}_2\, \delta(\mathbf{W}_1 \mathbf{z})\right), \qquad \tilde{\mathbf{x}}_c = s_c \cdot \mathbf{u}_c
```

z는 squeeze 결과, δ는 ReLU, σ는 sigmoid다. SE 블록은 인셉션 모듈이나 잔차 블록 뒤에 붙일 수 있다.

![X를 변환한 U에 squeeze, excitation, scale을 적용해 채널마다 색이 다른 출력을 만드는 SE 블록](./images/dl-cnn-transfer-learning-24.jpg '출력의 채널 색이 다른 것은 채널마다 다른 가중치가 곱해졌기 때문이다')

### 정확률과 계산량

모델별 top-1 정확률과 연산량(G-Ops), 파라미터 수를 함께 그리면 VGG가 비효율적인 구조임이 드러난다. Inception-v4는 ResNet과 인셉션을 결합한 모델이다.

![AlexNet부터 Inception-v4까지 top-1 정확률 막대그래프와, 연산량 대비 정확률을 원 크기로 파라미터 수와 함께 그린 그래프](./images/dl-cnn-transfer-learning-25.jpg 'VGG-16·19는 연산량과 파라미터가 가장 크지만 정확률은 ResNet-50보다 낮다')

## 전이 학습

전이 학습(transfer learning)은 어떤 도메인의 데이터로 학습한 모델을 다른 도메인에 적용해 성능을 높이는 방법이다. 텐서플로는 ImageNet으로 학습한 사전 학습 모델(Xception, VGG16·19, ResNet50·101·152, InceptionV3, InceptionResNetV2, MobileNet, DenseNet121·169·201 등)을 `tensorflow.keras.applications`로 제공하고, 전이 학습할 때는 보통 이들을 백본(backbone)으로 쓴다.

| 모델        | 크기  | top-1 정확률 | 파라미터 | 깊이 |
| ----------- | ----- | ------------ | -------- | ---- |
| VGG16       | 528MB | 71.3%        | 138.4M   | 16   |
| ResNet50    | 98MB  | 74.9%        | 25.6M    | 107  |
| InceptionV3 | 92MB  | 77.9%        | 23.9M    | 189  |
| MobileNet   | 16MB  | 70.4%        | 4.3M     | 55   |
| DenseNet121 | 33MB  | 75.0%        | 8.1M     | 242  |

### 사전 학습 모델로 자연 영상 인식

ImageNet으로 학습한 ResNet50을 그대로 써서 토끼 영상을 분류한다.

```python
import cv2 as cv
import numpy as np
from tensorflow.keras.applications.resnet50 import ResNet50, preprocess_input, decode_predictions

model = ResNet50(weights='imagenet')  # ImageNet으로 학습한 가중치

img = cv.imread('rabbit.jpg')
x = np.reshape(cv.resize(img, (224, 224)), (1, 224, 224, 3))
x = preprocess_input(x)

preds = model.predict(x)
top5 = decode_predictions(preds, top=5)[0]
print('예측 결과:', top5)
```

| 줄                                 | 역할                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| `ResNet50(weights='imagenet')`     | 1000부류 분류층까지 포함한 사전 학습 모델을 불러온다     |
| `np.reshape(…, (1, 224, 224, 3))`  | 영상 한 장을 배치 차원이 있는 텐서로 바꾼다              |
| `preprocess_input(x)`              | ResNet50 학습 시각과 같은 방식으로 정규화한다            |
| `decode_predictions(preds, top=5)` | 확률이 높은 5개 부류의 WordNet ID, 이름, 확률을 돌려준다 |

![wood_rabbit 0.743, hare 0.240, Angora 0.009, wallaby 0.003, fox_squirrel 0.001로 예측한 결과](./images/dl-cnn-transfer-learning-26.jpg '학습 없이 사전 학습 모델만으로 토끼를 맞힌다')

### 사전 학습 모델로 견종 인식

Stanford dogs 데이터셋은 개의 품종 120부류, 영상 20,580장으로 이루어진 미세 분류(fine-grained classification) 문제다. 품종 사이의 차이가 작아 일반 분류보다 어렵다.

데이터셋은 `datasets/stanford_dogs` 폴더에 images.tar, annotations.tar, list.tar를 내려받아 풀면 `images/images` 아래에 `n02085620-Chihuahua` 같은 120개 폴더가 생긴다. 폴더 이름 끝이 부류 이름이다.

다음 코드는 DenseNet121을 백본으로 쓰고, 분류층을 새로 붙여 미세 조정한다.

```python
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Flatten, Dense, Dropout, Rescaling
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.applications.densenet import DenseNet121
from tensorflow.keras.utils import image_dataset_from_directory
import pathlib

data_path = pathlib.Path('datasets/stanford_dogs/images/images')

# 폴더에서 데이터 읽기
train_ds = image_dataset_from_directory(data_path, validation_split=0.2, subset='training',
                                        seed=123, image_size=(224, 224), batch_size=16)
test_ds = image_dataset_from_directory(data_path, validation_split=0.2, subset='validation',
                                       seed=123, image_size=(224, 224), batch_size=16)

base_model = DenseNet121(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
cnn = Sequential()
cnn.add(Rescaling(1.0 / 255.0))
cnn.add(base_model)
cnn.add(Flatten())
cnn.add(Dense(1024, activation='relu'))
cnn.add(Dropout(0.75))
cnn.add(Dense(units=120, activation='softmax'))

cnn.compile(loss='sparse_categorical_crossentropy', optimizer=Adam(learning_rate=0.000001), metrics=['accuracy'])
hist = cnn.fit(train_ds, epochs=200, validation_data=test_ds, verbose=2)

print('정확률=', cnn.evaluate(test_ds, verbose=0)[1] * 100)

cnn.save('cnn_for_stanford_dogs.h5')  # 미세 조정된 모델을 파일에 저장

import pickle

f = open('dog_species_names.txt', 'wb')
pickle.dump(train_ds.class_names, f)
f.close()
```

| 줄                                       | 역할                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `image_dataset_from_directory(…)`        | 폴더 이름을 레이블로 삼아 데이터를 읽고, 20%를 검증 집합으로 떼어 둔다 |
| `DenseNet121(include_top=False)`         | ImageNet 1000부류 분류층을 배제하고 특징 추출부만 가져온다             |
| `Dense(units=120, activation='softmax')` | Stanford dogs의 120부류에 맞춘 새 분류층                               |
| `sparse_categorical_crossentropy`        | 레이블이 원핫이 아니라 정수 인덱스이므로 sparse 버전을 쓴다            |
| `Adam(learning_rate=0.000001)`           | 학습률을 아주 작게 해 특징 추출층의 사전 학습 가중치를 거의 유지한다   |
| `epochs=200`                             | 학습률이 작은 대신 세대 수를 늘려 오래 학습한다                        |
| `cnn.save(…)`, `pickle.dump(…)`          | 학습된 모델과 부류 이름 목록을 저장해 나중에 예측 프로그램에서 쓴다    |

> [!IMPORTANT] 미세 조정
> ==미세 조정(fine-tuning) 방식의 전이 학습은 사전 학습 가중치에서 출발해 전체 신경망을 아주 작은 학습률로 다시 학습한다.== 백본을 동결(`trainable=False`)하고 새 분류층만 학습하는 특징 추출 방식과 달리, 백본도 새 도메인에 맞게 조금씩 바뀐다.

16,464장으로 훈련하고 4,116장으로 검증한 결과 200세대 뒤 정확률은 82.73%다. 한 세대에 1,029번(16,464 / 16) 갱신하며, GPU가 있는 PC에서도 200세대 학습에 9시간 30분 정도가 걸렸다고 한다.

![Stanford dogs 미세 조정의 세대별 정확률·손실 그래프](./images/dl-cnn-transfer-learning-27.jpg '검증 정확률은 50세대 무렵 0.8을 넘은 뒤 거의 오르지 않는다')

검증 정확률이 첫 세대부터 훈련 정확률보다 빠르게 오르는 점이 눈에 띈다. 사전 학습 특징이 이미 개 품종을 구별할 만큼 좋고, 훈련 시각에만 적용되는 드롭아웃(0.75)이 훈련 정확률을 낮추기 때문이다.

## CNN 시각화: Grad-CAM 구현

CNN의 판단 근거를 영상 위에 히트맵으로 표시하는 기법이 CAM과 Grad-CAM이다. 원리는 [물체 검출의 성능 평가와 RCNN·YOLO](/memo/dl-object-detection)의 CAM·Grad-CAM 절에서 자세히 다루고, 여기서는 MobileNet과 버스 사진으로 Grad-CAM을 구현한다.

Grad-CAM은 부류 c의 점수 `y^c{:math}`를 특징 맵 `A^k{:math}`로 미분한 그레이디언트를 공간 평균해 채널 가중치를 구하고, 가중합에 ReLU를 적용한다.

```math
\alpha_k^c = \frac{1}{Z} \sum_i \sum_j \frac{\partial y^c}{\partial A_{ij}^k}, \qquad L_{\text{Grad-CAM}}^c = \mathrm{ReLU}\left(\sum_k \alpha_k^c A^k\right)
```

### 분류

```python
import tensorflow as tf
tf.compat.v1.disable_eager_execution()
import cv2 as cv
from google.colab.patches import cv2_imshow
import numpy as np
from keras.applications.mobilenet import MobileNet, preprocess_input, decode_predictions

model = MobileNet(weights='imagenet')

img = cv.imread('bus.jpg')
x = np.reshape(cv.resize(img, (224, 224)), (1, 224, 224, 3))
x = preprocess_input(x)

preds = model.predict(x)
top5 = decode_predictions(preds, top=5)[0]
print('예측 결과: ', top5)

for i in range(5):
    cv.putText(img, top5[i][1] + ':' + str(top5[i][2]), (10, 20 + i * 20), cv.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
cv2_imshow(img)
```

`disable_eager_execution(){:python}`는 뒤에서 쓰는 `K.gradients(){:python}`가 그래프 모드에서만 동작하기 때문에 넣었다.

![버스 사진을 trolleybus 0.950, school_bus 0.028, streetcar 0.020으로 분류한 결과](./images/dl-cnn-transfer-learning-28.jpg 'ImageNet에 시내버스 부류가 없어 가장 가까운 trolleybus로 분류한다 (발표 자료)')

### 특징 맵 층 고르기

`model.summary(){:python}`로 마지막 컨볼루션 출력을 찾았다. MobileNet의 마지막 블록은 depthwise 컨볼루션 `conv_dw_13`과 pointwise(1×1) 컨볼루션 `conv_pw_13`이고, 그 뒤 `conv_pw_13_relu`의 7×7×1024 출력이 GAP 직전의 마지막 특징 맵이다. 두 컨볼루션 모두 바이어스가 없고, 전체 파라미터는 4,253,864개다.

| 층                           | 출력     | 파라미터 계산         | 파라미터  |
| ---------------------------- | -------- | --------------------- | --------- |
| conv_dw_13 (DepthwiseConv2D) | 7×7×1024 | 3×3×1024              | 9,216     |
| conv_pw_13 (Conv2D)          | 7×7×1024 | 1×1×1024×1024         | 1,048,576 |
| conv_pw_13_bn                | 7×7×1024 |                       | 4,096     |
| conv_pw_13_relu (선택한 층)  | 7×7×1024 |                       | 0         |
| global_average_pooling2d     | 1×1×1024 |                       | 0         |
| conv_preds (Conv2D)          | 1×1×1000 | (1×1×1024 + 1) × 1000 | 1,025,000 |

### 히트맵 계산

```python
from keras import backend as K

class_index = np.argmax(preds[0])  # 예측 부류의 번호
output = model.output[:, class_index]  # 예측 부류의 점수

last_conv_layer = model.get_layer('conv_pw_13_relu')
grads = K.gradients(output, last_conv_layer.output)[0]  # 특징 맵에 대한 그레이디언트

pooled_grads = K.mean(grads, axis=(0, 1, 2))  # 채널별 그레이디언트 평균, (1024,) 벡터
iterate = K.function([model.input], [pooled_grads, last_conv_layer.output[0]])
pooled_grads_value, conv_layer_output_value = iterate([x])

for i in range(1024):  # 채널의 중요도를 특징 맵 채널에 곱한다
    conv_layer_output_value[:, :, i] *= pooled_grads_value[i]

heatmap = np.mean(conv_layer_output_value, axis=-1)  # 채널 축 평균이 클래스 활성화 히트맵
heatmap = np.maximum(heatmap, 0)  # ReLU
heatmap /= np.max(heatmap)  # 0~1로 정규화
```

| 코드                                    | Grad-CAM 수식과의 대응                         |
| --------------------------------------- | ---------------------------------------------- |
| `K.gradients(output, …)`                | `\partial y^c / \partial A^k_{ij}{:math}`      |
| `K.mean(grads, axis=(0, 1, 2))`         | 공간 평균으로 구한 `\alpha_k^c{:math}`         |
| `conv_layer_output_value[:, :, i] *= …` | `\alpha_k^c A^k{:math}`                        |
| `np.mean(…, axis=-1)`                   | 채널 합(평균은 상수배라 정규화 뒤 결과가 같다) |
| `np.maximum(heatmap, 0)`                | ReLU                                           |

### 영상에 겹치기

```python
img = cv.imread('bus.jpg')
heatmap = cv.resize(heatmap, (img.shape[1], img.shape[0]))  # 원본 크기로 확대
heatmap = np.uint8(255 * heatmap)
heatmap = cv.applyColorMap(heatmap, cv.COLORMAP_JET)
superimposed_img = heatmap * 0.4 + img  # 0.4는 히트맵의 강도

cv2_imshow(heatmap)
cv2_imshow(superimposed_img)
```

![7×7 히트맵을 확대한 JET 컬러맵과 버스 사진에 겹친 결과](./images/dl-cnn-transfer-learning-29.jpg '버스 옆면의 창과 출입문 부분이 가장 붉다 (발표 자료)')

히트맵은 버스 옆면의 창과 출입문 부근에서 가장 강하고, 앞 유리 쪽에도 약하게 반응한다. 7×7 특징 맵을 확대했기 때문에 경계가 거칠다. 모델이 trolleybus로 판단한 근거가 버스의 측면 형태라는 점을 확인할 수 있다.

## 정리

| 주제      | 핵심                                                                                  |
| --------- | ------------------------------------------------------------------------------------- |
| 구조      | 컨볼루션층(가중치 공유, 부분 연결) + 풀링층 + FC층                                    |
| 계산      | 출력 `\lfloor (N + 2P - F)/S \rfloor + 1{:math}`, 파라미터 `(F^2 C_{in} + 1)K{:math}` |
| 학습      | 역전파, 교차 엔트로피, Adam, 드롭아웃·데이터 증강·조기 멈춤                           |
| 대표 모델 | AlexNet → ZFNet → VGG(3×3) → GoogLeNet(인셉션) → ResNet(잔차) → SENet(채널 재가중)    |
| 전이 학습 | 사전 학습 백본 + 새 분류층, 작은 학습률로 미세 조정                                   |
| 시각화    | Grad-CAM으로 판단 근거를 히트맵으로 확인                                              |
