---
title: 순환 신경망과 LSTM으로 만든 시계열 예측
date: 2023-10-16
category: 학습/CS/딥러닝
series: 딥러닝 및 응용
seriesOrder: 4
summary: 시계열 데이터를 다루는 순환 신경망(RNN)의 구조와 순환식, 장기 의존성을 해결하는 LSTM의 세 게이트, 윈도우 단위 샘플링으로 만든 비트코인 가격 예측과 MAE·MAPE·등락 정확률 평가를 다룬다.
---

## 들어가기 전에

지난 일주일의 가격을 보고 내일 가격을 맞히는 문제를 생각한다. 입력의 각 값은 바로 앞 날의 값과 이어져 있어서 순서를 섞으면 전혀 다른 데이터가 된다. 문장도 같다. "개가 사람을 물었다"와 "사람이 개를 물었다"는 같은 명사와 동사로 이루어졌지만 뜻이 반대다. 게다가 기록 기간이나 문장 길이는 샘플마다 달라서, 입력 크기가 고정된 다층 퍼셉트론이나 영상 한 장을 받는 CNN에 그대로 넣기 어렵다.

순환 신경망(RNN, recurrent neural network)은 한 시각에 원소 하나를 읽고, 지금까지 읽은 내용을 은닉 상태에 담아 다음 시각으로 넘긴다. 모든 시각에 같은 가중치를 쓰므로 길이가 7이든 365든 같은 모델로 처리한다. 그러나 은닉 상태는 매 시각 새 입력과 섞이며 갱신되므로 수십 시각 앞의 정보는 빠르게 희미해진다. 이 장기 의존성 문제를 게이트로 푸는 구조가 LSTM이다.

예를 들어 7일치 비트코인 종가 (3772.9, 3799.7, 3811.6, …, 3832.1)을 입력으로 받아 8일째 종가 3849.0을 맞히는 모델을 만든다고 하자. RNN은 첫날 값을 읽어 은닉 상태를 만들고, 둘째 날 값과 그 은닉 상태를 합쳐 은닉 상태를 갱신하는 일을 7번 반복한 뒤 마지막 은닉 상태로 가격 하나를 출력한다. 아래 표의 순서로 이 구조와 한계, 실제 예측 결과를 설명한다.

| 순서 | 내용                                                               |
| ---- | ------------------------------------------------------------------ |
| 1    | 시계열 데이터와 RNN의 형태(many to one, one to many, many to many) |
| 2    | 윈도우 단위 샘플링과 비트코인 가격 데이터                          |
| 3    | RNN의 순환식, 활성 함수, 장기 의존성                               |
| 4    | LSTM의 망각·입력·출력 게이트와 셀 상태                             |
| 5    | 비트코인 가격 예측과 성능 평가(MAE, MAPE, 등락 정확률)             |

가중치, 활성 함수, 역전파로 학습하는 신경망의 기본 구조는 [컨볼루션 신경망의 구조와 전이 학습](/memo/dl-cnn-transfer-learning)의 다층 퍼셉트론과 CNN의 학습 절을 기준으로 한다. RNN은 여기에 시간 방향의 가중치 하나를 더한 구조다.

## 시계열 데이터

==시계열 데이터는 시간 축을 따라 신호가 변하는 동적 데이터, 즉 일정한 시간 간격으로 측정해 시간적 순서를 나타내는 데이터다.== 심전도, 주식 시세, 음성 신호가 대표적인 예다.

![심전도, 주식 시세 차트, 음성 파형](./images/dl-rnn-01.jpg '세 데이터 모두 시간 축을 따라 값이 변한다')

영상처럼 한꺼번에 입력받는 데이터를 정적 데이터라 한다. 시계열을 정적 데이터로 바꿔 넣으면 순서와 길이에 관한 정보가 사라진다. 예를 들어 1년치 기록을 길이 365의 벡터 하나로 펼쳐 다층 퍼셉트론에 넣으면, 입력층의 노드 수가 365로 고정되어 2년치 기록은 넣을 수 없고, 1일 값과 2일 값이 이웃한다는 사실도 모델이 따로 배워야 한다.

시계열 데이터는 가변 길이이고 벡터의 벡터다. 매일 기온, 습도, 미세먼지 농도를 기록한다면 하루치가 `\mathbf{a}^1 = (23.5, 42, 0.1){:math}`, `\mathbf{a}^2 = (25.5, 45, 0.08){:math}`처럼 벡터 하나이고, 샘플은 그 벡터를 시간순으로 나열한다.

```math
\mathbf{x} = \left(\mathbf{a}^1\ \mathbf{a}^2 \cdots \mathbf{a}^t\right)
```

길이 `t{:math}`는 샘플마다 다를 수 있다.

## 순환 신경망의 구조

순환 신경망은 구조가 유연해서 여러 문제에 적용할 수 있다.

| 응용                               | 예                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| 미래 예측(prediction, forecasting) | 내일 주가, 내일 날씨, 기계의 고장, 풍속과 풍향(풍력 발전기 효율 향상), 농산물 가격·수요량 |
| 언어 번역                          | 영어 문장을 한글 문장으로 변환                                                            |
| 음성 인식                          | 음성 신호를 문자열로 변환                                                                 |
| 생성 모델                          | 사진을 보고 설명 문장 생성                                                                |

==RNN은 은닉층의 출력을 다시 은닉층의 입력으로 사용한다.== 아래 왼쪽 그림처럼 은닉 상태 `h_t{:math}`가 가중치 W를 거쳐 자기 자신에게 돌아가는 고리를 시간 축으로 펼치면 오른쪽 그림이 된다. 펼친 그림의 칸 하나는 하루치 입력을 처리하고, 모든 칸이 같은 가중치 U, W, V를 사용한다.

![왼쪽은 은닉 상태 h_t가 가중치 W로 자기 자신에게 돌아가는 RNN, 오른쪽은 이를 시점 세 개로 펼쳐 비트코인 종가 3772.9, 3799.7, 3811.6을 차례로 읽고 마지막 h3에서 다음 날 가격을 출력하는 그림](./images/dl-rnn-unroll.svg '순환 고리를 시간 축으로 펼친 모습. 칸이 늘어나도 가중치 U, W, V는 하나씩이다')

시퀀스 길이에 관계없이 입력과 출력을 받아들일 수 있으므로 필요에 따라 구조를 다양하게 만들 수 있고, 입력 시퀀스와 예측 시퀀스의 길이에 따라 형태를 나눈다.

![일대다(one to many), 다대일(many to one), 지연·동기 두 종류의 다대다(many to many) RNN 형태](./images/dl-rnn-io-types.svg '빨강은 입력, 초록은 은닉 상태, 파랑은 출력이다')

| 형태         | 입력 → 출력              | 예                                                          |
| ------------ | ------------------------ | ----------------------------------------------------------- |
| Many to one  | 여러 시점 X → 하나의 Y   | 여러 시점의 다변량 센서 데이터로 특정 시점의 제품 상태 예측 |
| One to many  | 단일 시점 X → 순차적인 Y | 이미지를 보고 설명 문장을 생성하는 이미지 캡셔닝            |
| Many to many | 순차적인 X → 순차적인 Y  | 단어마다 품사를 붙이는 POS(part of speech) tagging, 번역    |

![센서 다섯 개의 시점 t-2, t-1, t 데이터를 차례로 입력해 시점 t의 정상·불량을 예측하는 many to one 구조](./images/dl-rnn-03.jpg '세 시점의 센서 값을 차례로 읽고 마지막 시점에서만 정상/불량을 출력한다')

![전화하는 남자 사진 한 장을 입력해 남자가, 전화를, 한다를 차례로 생성하는 one to many 구조](./images/dl-rnn-04.jpg '이미지 캡셔닝에서는 앞 시점에 생성한 단어가 다음 시점의 입력이 된다')

같은 many to many라도 입력과 출력이 시점마다 짝을 이루는 경우(품사 태깅: 남자가 → 주어, 전화를 → 목적어, 한다 → 동사)와, 입력을 모두 읽은 뒤 출력을 시작하는 경우(번역)가 있다.

![I Love You와 EOS를 읽은 뒤 나는 너를 사랑해를 출력하는 번역 구조](./images/dl-rnn-05.jpg '번역은 입력 문장을 끝(EOS)까지 읽은 뒤 출력을 시작한다')

## 미래 예측을 위한 데이터 준비

농산물 유통업자가 5년 동안 매일 판매량을 기록했다면 길이 `t = 365 \times 5 = 1825{:math}`인 샘플 하나가 생긴다. 샘플 하나로는 가중치를 갱신할 기회가 한 번뿐이므로, 긴 기록을 짧은 구간으로 잘라 여러 샘플을 만든다. 구간의 길이와 예측할 거리는 다음 두 하이퍼파라미터로 정한다.

| 하이퍼파라미터         | 의미                                       | 예           |
| ---------------------- | ------------------------------------------ | ------------ |
| 윈도우 크기 `w{:math}` | 한 샘플의 입력으로 자르는 구간의 길이      | `w=3{:math}` |
| 수평선 계수 `h{:math}` | 입력 구간 끝에서 얼마나 먼 미래를 예측할지 | `h=1{:math}` |

![상추 판매량 12, 10, 8, 15, …를 윈도우 3으로 잘라 다음 값을 레이블로 삼는 샘플링](./images/dl-rnn-06.jpg '(12, 10, 8)을 입력으로, 그다음 값 15를 레이블로 삼고 한 칸씩 민다')

길이 `t{:math}`인 시계열에서 만들 수 있는 샘플은 `t - w - h + 1{:math}`개다. 그림의 마지막 샘플 번호 `t - w{:math}`는 `h = 1{:math}`일 때의 값이다.

여러 품목을 함께 예측하면 각 시점의 값이 벡터가 된다. 상추와 오이를 동시에 고려하면 다음 샘플이 생긴다.

| 샘플           | x (오이, 상추)                 | y        |
| -------------- | ------------------------------ | -------- |
| 1              | ((34, 12), (35, 10), (36, 8))  | (35, 15) |
| 2              | ((35, 10), (36, 8), (35, 15))  | (32, 16) |
| 3              | ((36, 8), (35, 15), (32, 16))  | (38, 15) |
| 4              | ((35, 15), (32, 16), (38, 15)) | (39, 14) |
| `t - w{:math}` | ((22, 19), (20, 20), (25, 23)) | (23, 22) |

### 비트코인 가격 데이터

코인데스크(coindesk.com)에서 2019-02-28부터 1년치 비트코인 가격을 CSV로 내려받는다. 열은 Currency, Date, Closing Price(USD), 24h Open(USD), 24h High(USD), 24h Low(USD) 여섯 개다.

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# 코인데스크 사이트에서 다운로드한 1년치 비트코인 가격 데이터 읽기
f = open('BTC_USD_2019-02-28_2020-02-27-CoinDesk.csv', 'r')
coindesk_data = pd.read_csv(f, header=0)
seq = coindesk_data[['Closing Price (USD)']].to_numpy()  # 종가만 취함
print('데이터 길이:', len(seq), '\n앞쪽 5개 값:', seq[0:5])

# 그래프로 데이터 확인
plt.plot(seq, color='red')
plt.title('Bitcoin Prices (1 year from 2019-02-28)')
plt.xlabel('Days'); plt.ylabel('Price in USD')
plt.show()
```

`header=0`은 첫 번째 행을 열 이름으로 사용하라는 지시다. `[['Closing Price (USD)']]`처럼 대괄호를 두 겹 사용하면 열 하나짜리 데이터프레임이 되고, `to_numpy()`가 이를 `(365, 1)` 넘파이 배열로 변환한다.

![데이터 길이 365, 앞쪽 다섯 값 3772.9부터, 4000달러에서 12000달러까지 치솟았다가 내려오는 가격 그래프](./images/dl-rnn-07.jpg '전반부에 크게 치솟고 후반부는 상대적으로 안정세다')

```python
# 시계열 데이터를 윈도우 단위로 자르는 함수
def seq2dataset(seq, window, horizon):
    X = []; Y = []
    for i in range(len(seq) - (window + horizon) + 1):
        x = seq[i:(i + window)]
        y = (seq[i + window + horizon - 1])
        X.append(x); Y.append(y)
    return np.array(X), np.array(Y)

w = 7  # 윈도우 크기
h = 1  # 수평선 계수

X, Y = seq2dataset(seq, w, h)
print(X.shape, Y.shape)
print(X[0], Y[0]); print(X[-1], Y[-1])
```

```text
(358, 7, 1) (358, 1)
[[3772.93633533] [3799.67854295] [3811.61197937] [3804.41917011]
 [3782.66410112] [3689.86289319] [3832.08088473]] [3848.95636968]
[[9701.0371915 ] [9631.48494596] [9670.85865437] [9689.08674285]
 [9919.55144784] [9640.46950506] [9392.86962872]] [8787.97836316]
```

샘플 수는 `365 - (7 + 1) + 1 = 358{:math}`이다. 첫 샘플은 0~6일의 가격으로 7일의 가격을 예측하고, 마지막 샘플은 357~363일의 가격으로 364일(마지막 날)의 가격 8787.98을 예측한다.

## 순환 신경망

### 다층 퍼셉트론과의 차이

==RNN은 은닉층 노드 사이에 순환 에지(recurrent edge)가 있다는 점을 제외하면 다층 퍼셉트론과 같다.==

![다층 퍼셉트론과, 은닉 노드 사이에 순환 에지 W를 추가한 순환 신경망 비교](./images/dl-rnn-08.jpg '순환 신경망은 다층 퍼셉트론의 가중치 U, V에 순환 에지의 가중치 W를 추가한다')

| 모델          | 가중치 집합 | 역할                                                   |
| ------------- | ----------- | ------------------------------------------------------ |
| 다층 퍼셉트론 | {U, V}      | U: 입력층 → 은닉층, V: 은닉층 → 출력층                 |
| 순환 신경망   | {U, V, W}   | W: 이전 시점의 은닉층 → 현재 시점의 은닉층 (순환 에지) |

순방향 신경망(feedforward neural network)은 이전 시점 정보를 반영하지 않고 현재 시점 정보만으로 예측한다. 센서 데이터의 예에서 순방향 신경망은 시점 1, 2, 3을 각각 독립적으로 처리한다.

```math
\mathbf{h}_1 = f(W_{xh}\mathbf{x}_1), \quad \mathbf{y}_1 = g(W_{hy}\mathbf{h}_1), \qquad f = \tanh,\ g = \mathrm{softmax}
```

`\mathbf{x}_t{:math}`는 설명 변수(센서 다섯 개의 값), `\mathbf{h}_t{:math}`는 은닉층, `\mathbf{y}_t{:math}`는 반응 변수(정상·불량)다. 시점 3에서 불량을 예측할 때도 시점 1, 2의 값은 사용하지 않는다.

RNN은 이전 시점의 은닉 상태를 현재 시점에 더해 `t-2{:math}` 시점의 정보까지 반영한다.

```math
\begin{aligned}
\mathbf{h}_{t-1} &= f(W_{xh}\mathbf{x}_{t-1} + W_{hh}\mathbf{h}_{t-2}) \\
\mathbf{h}_t &= f(W_{xh}\mathbf{x}_t + W_{hh}\mathbf{h}_{t-1}) \\
\mathbf{y}_t &= g(W_{hy}\mathbf{h}_t)
\end{aligned}
```

![시점 t-2, t-1, t의 은닉 상태가 W_hh로 이어지고 마지막에 정상·불량을 출력하는 RNN](./images/dl-rnn-09.jpg '모든 시점이 같은 W_xh, W_hh를 공유한다')

### 순환식

RNN은 매 시점 같은 순환식을 적용한다. 새 상태 `h_t{:math}`는 이전 상태 `h_{t-1}{:math}`와 현재 입력 `x_t{:math}`의 함수이고, 함수와 파라미터 `W{:math}`는 모든 시점에서 같다.

```math
h_t = f_W(h_{t-1}, x_t)
```

가장 단순한 형태(vanilla RNN)는 다음과 같다.

```math
\begin{aligned}
h_t &= \tanh(W_x x_t + W_h h_{t-1} + b_h) \\
y_t &= f(W_y h_t + b_y)
\end{aligned}
```

계산 그래프로 펼치면 `h_0 \to h_1 \to h_2 \to \cdots \to h_T{:math}`로 같은 `f_W{:math}`가 반복되고, 가중치 `W{:math}`는 모든 시점에서 재사용된다. Many to many에서는 시점마다 출력 `y_t{:math}`와 손실 `L_t{:math}`가 생기고, 전체 손실은 그 합이다.

```math
L = \sum_{t=1}^{T} L_t
```

![h0부터 hT까지 f_W를 반복하고 시점마다 y와 손실 L을 계산하는 many to many 계산 그래프](./images/dl-rnn-10.jpg '같은 W가 모든 시점에 사용되고, 시점별 손실 L1~LT를 더해 전체 손실 L을 얻는다')

같은 `W{:math}`가 여러 시점에 쓰이므로 `W{:math}`에 대한 그레이디언트는 시점별 그레이디언트의 합이다. 펼친 그래프를 시간 역방향으로 따라가며 오류를 역전파하는 방법을 BPTT(backpropagation through time)라 한다.

### 활성 함수

순환 신경망은 은닉층의 활성 함수로 하이퍼볼릭 탄젠트를 주로 사용한다.

| 항목        | tanh             | sigmoid             |
| ----------- | ---------------- | ------------------- |
| 범위        | (-1, 1)          | (0, 1)              |
| 중앙값      | 0                | 0.5                 |
| 미분 최댓값 | 1 (`x=0{:math}`) | 0.25 (`x=0{:math}`) |

```math
\tanh'(x) = 1 - \tanh^2(x), \qquad \sigma'(x) = \sigma(x)\bigl(1 - \sigma(x)\bigr)
```

`x=0{:math}`에서 `\tanh(0)=0{:math}`이므로 미분은 1, `\sigma(0)=0.5{:math}`이므로 미분은 `0.5 \times 0.5 = 0.25{:math}`다.

![시그모이드 미분(파란 점선)과 tanh 미분(초록 실선) 그래프](./images/dl-rnn-activation-derivative.svg 'tanh 미분은 최댓값 1, 시그모이드 미분은 최댓값 0.25다')

tanh는 시그모이드보다 출력 범위가 넓어 출력값의 변화 폭이 크고, 미분값도 커서 기울기 소실(gradient vanishing)이 덜하다.

### RNN의 한계

RNN은 은닉 상태를 다음 순간으로 넘기는 기능으로 과거를 기억한다. 하지만 ==멀리 떨어진 요소가 밀접하게 상호작용하는 장기 문맥 의존성(long-term dependency)을 제대로 처리하지 못한다.== 입력이 계속 들어오면 매 시점 새 입력이 순차적으로 더해지므로 오래된 정보의 영향이 줄어든다. 역전파 쪽에서 보면 `W_h{:math}`와 tanh 미분(1 이하)이 시점 수만큼 곱해지므로 먼 시점까지 그레이디언트가 전달되지 않는다.

<details>
<summary>그레이디언트가 시점 수만큼 곱해지는 과정</summary>

`h_t = \tanh(a_t){:math}`, `a_t = W_x x_t + W_h h_{t-1} + b_h{:math}`이면 한 시점 사이의 야코비 행렬은 다음과 같다.

```math
\frac{\partial h_t}{\partial h_{t-1}} = \mathrm{diag}\bigl(1 - \tanh^2(a_t)\bigr)\, W_h
```

시점 `k{:math}`의 은닉 상태가 시점 `t{:math}`의 손실에 주는 영향은 이 행렬을 `t-k{:math}`번 곱한 값이다.

```math
\frac{\partial h_t}{\partial h_k} = \prod_{j=k+1}^{t} \mathrm{diag}\bigl(1 - \tanh^2(a_j)\bigr)\, W_h
```

곱해지는 행렬의 크기에 따라 결과가 갈린다.

| 경우                            | 조건                                                       | 결과                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 기울기 소실                     | 한 번 곱할 때마다 크기가 0.5배                             | 20시점 뒤 `0.5^{20} \approx 9.5 \times 10^{-7}{:math}`. 먼 시점의 입력이 학습에 거의 반영되지 않는다                  |
| 기울기 폭주(gradient exploding) | `W_h{:math}`의 고윳값 크기가 1보다 크다                    | 곱이 지수적으로 커진다. 그레이디언트의 노름을 일정 값 이하로 자르는 그레이디언트 클리핑(gradient clipping)으로 막는다 |
| LSTM 셀 상태 경로               | `\partial C_t / \partial C_{t-1} = f_t{:math}` (원소별 곱) | 망각 게이트 `f_t{:math}`가 1에 가까우면 곱이 줄어들지 않는다                                                          |

</details>

사람은 선별 기억 능력으로 중요한 기억을 오래 간직한다. 이 능력을 신경망에 넣은 구조가 LSTM이다.

## LSTM

LSTM(Long Short-Term Memory, [Hochreiter & Schmidhuber, 1997](https://doi.org/10.1162/neco.1997.9.8.1735))은 RNN의 한 종류로, ==게이트라는 개념으로 장단기 기억을 가능하게 설계한 신경망이다.== 게이트를 여닫는 정도는 0과 1 사이의 실수로 표현하고, 그 값을 학습으로 알아낸다.

![반복되는 LSTM 셀 세 개. 가운데 셀 안에 σ, σ, tanh, σ 네 층과 위쪽 수평선인 셀 상태, 아래쪽 수평선인 은닉 상태가 있다](./images/dl-rnn-lstm-chain.svg '위쪽 수평선이 셀 상태이고, 노란 상자 네 개가 서로 정보를 주고받는 층이다')

| 구성                             | 역할                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| 셀 상태(cell state) `C_t{:math}` | LSTM의 핵심. 그림의 위쪽 수평선으로, 정보를 큰 변형 없이 다음 시점으로 전달           |
| 게이트                           | 셀 상태에 정보를 더하거나 없애는 구조. 시그모이드 출력(0~1)을 곱해 통과 비율을 정한다 |
| 층 네 개                         | 망각 게이트 σ, 입력 게이트 σ, 후보값 tanh, 출력 게이트 σ                              |

vanilla RNN의 셀 안에는 tanh 층 하나만 있다. LSTM은 네 층이 상호작용한다.

### 망각 게이트

망각 게이트(forget gate)는 새 입력과 이전 상태를 참조해 이전 셀 상태 `C_{t-1}{:math}`를 얼마의 비율로 잊을지 결정한다. 과거 정보 가운데 불필요한 기억을 잊게 해 주는 게이트다.

```math
f_t = \sigma\left(W_f \cdot [h_{t-1}, x_t] + b_f\right)
```

![LSTM 셀에서 h_{t-1}과 x_t가 σ 층을 지나 f_t가 되는 망각 게이트와 그 수식](./images/dl-rnn-forget-gate.svg 'f_t가 0이면 이전 셀 상태를 모두 잊고 1이면 모두 유지한다')

`[h_{t-1}, x_t]{:math}`는 두 벡터를 이어 붙인 벡터다.

### 입력 게이트와 셀 상태 갱신

입력 게이트(input gate)는 새 입력과 이전 상태를 참조해 새 정보를 얼마의 비율로 활용할지 결정한다. tanh 층은 셀 상태에 더할 후보값 `\tilde{C}_t{:math}`를 만든다.

```math
\begin{aligned}
i_t &= \sigma\left(W_i \cdot [h_{t-1}, x_t] + b_i\right) \\
\tilde{C}_t &= \tanh\left(W_C \cdot [h_{t-1}, x_t] + b_C\right) \\
C_t &= f_t * C_{t-1} + i_t * \tilde{C}_t
\end{aligned}
```

![입력 게이트 i_t와 후보값 C̃_t를 만드는 σ 층과 tanh 층, 그리고 두 수식](./images/dl-rnn-input-gate.svg 'i_t는 새 정보를 얼마나 받아들일지, C̃_t는 받아들일 후보값을 정한다')

![f_t와 i_t로 셀 상태 C_{t-1}을 C_t로 갱신하는 과정과 그 수식](./images/dl-rnn-cell-update.svg '잊을 만큼 잊고(f_t × C_{t-1}) 새 정보를 더한다(i_t × C̃_t)')

`*`는 원소별 곱이다. ==셀 상태는 곱셈 한 번과 덧셈 한 번만 거쳐 다음 시점으로 넘어가므로, 망각 게이트가 1에 가까우면 정보와 그레이디언트가 먼 시점까지 전달된다.==

### 출력 게이트

출력 게이트(output gate)는 최종적으로 얻은 셀 상태에서 얼마를 꺼내 은닉 상태 `h_t{:math}`로 출력할지 결정한다.

```math
\begin{aligned}
o_t &= \sigma\left(W_o \cdot [h_{t-1}, x_t] + b_o\right) \\
h_t &= o_t * \tanh(C_t)
\end{aligned}
```

![σ 층이 o_t를 만들고 tanh(C_t)와 곱해 h_t를 출력하는 출력 게이트와 그 수식](./images/dl-rnn-output-gate.svg '셀 상태를 tanh로 -1~1 범위로 바꾼 뒤 출력 게이트만큼 내보낸다')

<details>
<summary>LSTM 층의 파라미터 수</summary>

네 층(`f, i, \tilde{C}, o{:math}`)이 모두 `[h_{t-1}, x_t]{:math}`를 입력으로 받으므로, 입력 차원 `d{:math}`, 은닉 차원 `n{:math}`이면 파라미터는 다음과 같다.

```math
4 \times \bigl(n \times (d + n) + n\bigr)
```

[단어 임베딩과 seq2seq, 어텐션](/memo/dl-word-embedding-attention)의 IMDB 감정 분류에서 `d = 16, n = 32{:math}`이면 `4 \times (32 \times 48 + 32) = 6272{:math}`로, `model.summary()`의 lstm 층 값과 같다. vanilla RNN(`SimpleRNN`)은 층이 하나이므로 `n \times (d + n) + n{:math}`이다.

</details>

## 시계열 데이터 예측하기

비트코인 데이터를 윈도우 7, 수평선 1로 자른 358개 샘플을 훈련 70%, 테스트 30%로 나눈다.

```python
# 훈련 집합과 테스트 집합으로 분할
split = int(len(X) * 0.7)
x_train = X[0:split]; y_train = Y[0:split]
x_test = X[split:]; y_test = Y[split:]
```

`int(358 \times 0.7) = 250{:math}`이므로 훈련 샘플은 250개, 테스트 샘플은 108개다. 시계열은 섞지 않고 앞 70%로 학습해 뒤 30%를 예측한다. 무작위로 섞으면 테스트 샘플의 바로 앞뒤 날짜가 훈련에 들어가, 모델이 실제로는 알 수 없는 미래 가격을 학습한 상태로 평가된다.

![종가 365일을 윈도우 7, 수평선 1로 잘라 0~6일로 7일을, 357~363일로 364일을 예측하는 샘플 358개를 만들고, 앞 250개를 훈련, 뒤 108개를 테스트로 나누는 그림](./images/dl-rnn-split.svg '샘플 생성과 시간순 분할. 테스트 구간은 훈련 구간보다 뒤의 날짜만 담는다')

### RNN과 LSTM 모델

```python
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import SimpleRNN, Dense

# RNN 모델 설계와 학습
model = Sequential()
model.add(SimpleRNN(units=128, activation='relu', input_shape=x_train[0].shape))
model.add(Dense(1))
model.compile(loss='mae', optimizer='adam', metrics=['mae'])
hist = model.fit(x_train, y_train, epochs=200, batch_size=1, validation_data=(x_test, y_test), verbose=2)

# RNN 모델 평가
ev = model.evaluate(x_test, y_test, verbose=0)
print("손실 함수:", ev[0], "MAE:", ev[1])

# RNN 모델로 예측 수행
pred = model.predict(x_test)
print("평균절댓값백분율오차(MAPE):", sum(abs(y_test - pred) / y_test) / len(x_test))
```

| 줄                             | 의미                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| `input_shape=x_train[0].shape` | `(7, 1)`. 7개 시점에 값 1개씩 입력                             |
| `SimpleRNN(units=128)`         | 은닉 상태 128차원. 마지막 시점의 은닉 상태만 출력(many to one) |
| `Dense(1)`                     | 다음 날 가격 하나를 출력                                       |
| `loss='mae'`                   | 평균절댓값오차를 손실로 사용                                   |
| `batch_size=1`                 | 샘플 하나마다 가중치 갱신                                      |

LSTM 모델은 `SimpleRNN`을 `LSTM`으로 바꾸고 나머지는 같다.

```python
from tensorflow.keras.layers import Dense, LSTM, Dropout

model = Sequential()
model.add(LSTM(units=128, activation='relu', input_shape=x_train[0].shape))
model.add(Dense(1))
```

파라미터 수는 SimpleRNN 층이 `128 \times (1 + 128) + 128 = 16640{:math}`, LSTM 층이 그 4배인 `66560{:math}`이다.

> [!NOTE]
> 코드의 MAPE 출력은 100을 곱하지 않은 비율이다. 0.03이 출력되면 평균 3%의 오차라는 뜻이다.

### 학습 곡선과 예측 결과

```python
# 학습 곡선
plt.plot(hist.history['mae'])
plt.plot(hist.history['val_mae'])
plt.title('Model mae')
plt.ylabel('mae')
plt.xlabel('Epoch')
plt.ylim([120, 800])
plt.legend(['Train', 'Validation'], loc='best')
plt.grid()
plt.show()

# 예측 결과 시각화
x_range = range(len(y_test))
plt.plot(x_range, y_test[x_range], color='red')
plt.plot(x_range, pred[x_range], color='blue')
plt.legend(['True prices', 'Predicted prices'], loc='best')
plt.grid()
plt.show()

# 일부 구간을 확대하여 시각화
x_range = range(50, 64)
plt.plot(x_range, y_test[x_range], color='red')
plt.plot(x_range, pred[x_range], color='blue')
plt.legend(['True prices', 'Predicted prices'], loc='best')
plt.grid()
plt.show()
```

![RNN과 LSTM 각각의 epoch별 훈련(Train)·검증(Validation) MAE 곡선, 테스트 구간 전체의 실제·예측 가격, 50~63 구간 확대](./images/dl-rnn-16.jpg '빨강(True prices)은 실제 가격, 파랑(Predicted prices)은 예측 가격이다. 두 모델 모두 실제 가격을 하루 늦게 따라가는 모양이다')

그래프의 검증 MAE는 대부분 훈련 MAE보다 낮지만 epoch마다 크게 출렁이고, 순간적으로 훈련 MAE보다 훨씬 커진다. 훈련 구간과 테스트 구간의 가격 분포 차이가 크기 때문이다. `batch_size=1`로 샘플마다 가중치를 갱신하므로 epoch 사이의 변동도 크다. 확대한 그래프에서 파란 예측선은 빨간 실제값을 한 칸 늦게 따라간다. 모델의 예측이 "내일 가격은 오늘 가격과 비슷하다"는 단순한 규칙을 따라 움직인다는 뜻이다. 가상의 예로 실제 가격이 9,500에서 9,800으로 오른 날, 모델은 그날 9,500 근처를 예측하고 다음 날에야 9,800 근처를 예측한다.

### 성능 평가

==평균절댓값오차(MAE)는 값의 스케일에 따라 커지므로 스케일 문제에 대처하지 못하고, 평균절댓값백분율오차(MAPE)는 오차를 참값으로 나누어 스케일 문제에 대처한다.== `M{:math}`은 테스트 집합, `y{:math}`는 참값, `o{:math}`는 예측값이다.

```math
\mathrm{MAE} = \frac{1}{|M|}\sum_{\mathbf{x} \in M} |y - o|, \qquad \mathrm{MAPE} = \frac{1}{|M|}\sum_{\mathbf{x} \in M} \left|\frac{y - o}{y}\right|
```

| 데이터 스케일 | 참값 y_test / 예측 pred                       | MAE                              | MAPE   |
| ------------- | --------------------------------------------- | -------------------------------- | ------ |
| 두 자릿수     | [12 20 18 22 28] / [10 21 16 20 26]           | `(2+1+2+2+2)/5 = 1.8{:math}`     | 0.0980 |
| 세 자릿수     | [120 200 180 220 280] / [100 210 160 200 260] | `(20+10+20+20+20)/5 = 18{:math}` | 0.0980 |

MAPE는 `(2/12 + 1/20 + 2/18 + 2/22 + 2/28)/5 = 0.4901/5 = 0.0980{:math}`이고, 세 자릿수 데이터도 오차와 참값이 같은 비율로 커지므로 같은 값이다. MAE는 10배 차이가 난다.

주가처럼 오르내림이 중요한 문제에서는 등락 정확률을 사용한다. 입력 윈도우의 마지막 값과 비교해 참값과 예측값이 같은 방향(상승·하락)인지 확인하고, 맞힌 경우의 수를 전체 샘플 수로 나눈다.

| 샘플 | x_test 마지막 값 | y_test | pred | 참값 방향 | 예측 방향 | 맞힘 |
| ---- | ---------------- | ------ | ---- | --------- | --------- | ---- |
| 1    | 21               | 23     | 24   | 상승      | 상승      | O    |
| 2    | 25               | 20     | 26   | 하락      | 상승      | X    |
| 3    | 22               | 24     | 23   | 상승      | 상승      | O    |
| 4    | 28               | 25     | 26   | 하락      | 하락      | O    |
| 5    | 21               | 18     | 17   | 하락      | 하락      | O    |
| 6    | 32               | 31     | 33   | 하락      | 상승      | X    |
| 7    | 35               | 36     | 37   | 상승      | 상승      | O    |
| 8    | 20               | 19     | 22   | 하락      | 상승      | X    |

등락 정확률은 `5/8 = 62.5\%{:math}`다.

## 정리

| 주제        | 핵심                                                                              |
| ----------- | --------------------------------------------------------------------------------- |
| RNN         | `h_t = \tanh(W_x x_t + W_h h_{t-1} + b_h){:math}`. 모든 시점이 같은 가중치를 공유 |
| LSTM        | 셀 상태와 망각·입력·출력 게이트로 장기 의존성을 처리                              |
| 시계열 예측 | 윈도우 `w{:math}`, 수평선 `h{:math}`로 샘플 생성. MAE, MAPE, 등락 정확률로 평가   |

==RNN은 모든 시점에 같은 가중치를 공유해 길이가 다른 시퀀스를 처리하고, LSTM은 셀 상태와 게이트로 먼 시점의 정보를 보존한다.== 다음 글에서는 같은 RNN으로 텍스트를 다루기 위해 단어를 벡터로 바꾸는 임베딩과, 문장을 문장으로 바꾸는 seq2seq·어텐션을 정리한다.

<details>
<summary>참고 문헌</summary>

- Hochreiter, Schmidhuber, [「Long Short-Term Memory」](https://doi.org/10.1162/neco.1997.9.8.1735), Neural Computation, 1997
- Werbos, [「Backpropagation Through Time: What It Does and How to Do It」](https://doi.org/10.1109/5.58337), Proceedings of the IEEE, 1990
- Pascanu, Mikolov, Bengio, [「On the difficulty of training Recurrent Neural Networks」](https://arxiv.org/abs/1211.5063), ICML 2013
- Christopher Olah, [「Understanding LSTM Networks」](https://colah.github.io/posts/2015-08-Understanding-LSTMs/), 2015
- Keras 문서, [SimpleRNN layer](https://keras.io/api/layers/recurrent_layers/simple_rnn/), [LSTM layer](https://keras.io/api/layers/recurrent_layers/lstm/)
- pandas 문서, [pandas.read_csv](https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html)

</details>
