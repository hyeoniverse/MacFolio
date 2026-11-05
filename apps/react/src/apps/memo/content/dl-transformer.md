---
title: 트랜스포머의 셀프 어텐션과 멀티 헤드 어텐션
date: 2023-11-13
category: CS/딥러닝
series: 딥러닝 및 응용
seriesOrder: 7
summary: 순환 신경망 없이 어텐션만으로 만든 트랜스포머의 인코더·디코더 구조, 위치 인코딩, 셀프 어텐션과 멀티 헤드 어텐션 계산 예제, 마스킹, 층별 가중치 수를 정리했다.
---

딥러닝 및 응용 연재의 일곱 번째 글로, 2017년 논문 「Attention Is All You Need」가 제안한 트랜스포머(Transformer)를 다룬다. 인코더와 디코더가 어떤 층으로 이루어지는지, 위치 인코딩과 셀프 어텐션이 행렬로 어떻게 계산되는지를 작은 수치 예제로 따라가고, 학습할 가중치 수까지 계산한다.

## seq2seq에서 트랜스포머로

[단어 임베딩과 seq2seq, 어텐션을 다룬 5편](/memo/dl-word-embedding-attention)에서 seq2seq와 어텐션을 정리했다. seq2seq는 인코더 RNN이 입력 문장을 읽고 디코더 RNN이 출력 문장을 만드는 구조이고, 어텐션은 디코더가 단어를 만드는 시각마다 인코더의 모든 은닉 상태 중 어디에 주목할지를 계산해 문맥 벡터를 만든다. 5편의 어텐션에서 query는 디코더의 은닉 상태 하나, 즉 벡터 하나였다.

트랜스포머는 2017년 구글이 자연어 처리를 위해 제안한 모델이다[^vaswani]. ==트랜스포머는 컨볼루션 신경망과 순환 신경망의 구성 요소를 모두 없애고 어텐션(주목)만으로 신경망을 구현한다.== 논문은 2023년 11월 12일 구글 스칼라 기준으로 96,297회 인용됐다.

![논문 「Attention Is All You Need」의 첫 쪽: 저자 8명과 초록](./images/dl-transformer-01.jpg '논문 초록: 순환과 컨볼루션 없이 어텐션 메커니즘만 쓴다 (강의 자료)')

| 구분           | 기존 seq2seq                        | 트랜스포머                                      |
| -------------- | ----------------------------------- | ----------------------------------------------- |
| 인코더·디코더  | 인코더와 디코더가 각각 RNN 하나     | 인코더 블록 N개, 디코더 블록 N개 (논문은 N = 6) |
| 단어 입력      | 시각마다 한 단어씩 순서대로         | 문장의 모든 단어를 한꺼번에                     |
| 순서 정보      | 순환 구조 자체가 순서를 반영        | 위치 인코딩을 더해 반영                         |
| 단어 사이 관계 | 디코더가 인코더에 주목하는 어텐션만 | 셀프 어텐션으로 같은 문장 안의 단어끼리도 주목  |

![기존 seq2seq(인코더 하나, 디코더 하나)와 트랜스포머(인코더 6개, 디코더 6개, 마지막 인코더 출력이 모든 디코더로 연결)의 비교 그림](./images/dl-transformer-03.jpg '"I am a student"를 "je suis étudiant"로 번역할 때 마지막 인코더의 출력이 여섯 디코더 모두에 전달된다 (강의 자료)')

## 모델 구조

![트랜스포머 전체 구조도: 왼쪽 인코더 블록(Multi-Head Attention, Feed Forward, Add & Norm)과 오른쪽 디코더 블록(Masked Multi-Head Attention, Multi-Head Attention, Feed Forward), 그 위의 Linear와 Softmax](./images/dl-transformer-02.jpg '인코더 블록과 디코더 블록을 각각 N번 쌓고, 디코더 출력은 Linear와 Softmax를 거쳐 단어 확률이 된다 (강의 자료)')

트랜스포머는 6개의 인코더 층과 6개의 디코더 층으로 이루어지고, 디코더는 인코더로부터 정보를 전달받아 출력 결과를 만든다. 디코더는 시작 심볼 `<sos>`를 입력받아 종료 심볼 `<eos>`가 나올 시각까지 연산을 반복한다.

| 블록   | 구성 층                                                                                            | 층 수 |
| ------ | -------------------------------------------------------------------------------------------------- | ----- |
| 인코더 | Multi-head attention(MHA), Feed Forward(FF)                                                        | 2     |
| 디코더 | Masked MHA, MHA(인코더-디코더), FF                                                                 | 3     |
| 공통   | 각 층 뒤에 Add & Norm. Add는 잔차 연결(residual connection), Norm은 층 정규화(layer normalization) |       |

MHA 층은 셀프 어텐션(self-attention, 자기 주목)을 담당하고, 헤드를 여러 개 써서 성능을 높인다. FF 층은 완전 연결층에 해당한다.

입력 쪽에서는 문장의 모든 단어를 한꺼번에 넣기 때문에 단어끼리 서로 주목하는 셀프 어텐션이 가능하다. 단어는 임베딩을 통해 `d_{model}{:math}` 차원 벡터가 되고(논문은 `d_{model} = 512{:math}`), `T{:math}`개 단어로 된 문장은 `T \times d_{model}{:math}` 행렬이 된다. 단어의 위치 정보는 위치 인코딩(positional encoding)으로 더한다.

### 세 MHA 층

트랜스포머에는 MHA 층이 세 개 있고, 어텐션은 모두 이 층들이 담당한다. 셋은 query(Q), key(K), value(V)를 어디서 가져오는지가 다르다.

| 층                  | Query       | Key, Value  | 셀프 어텐션 여부                             |
| ------------------- | ----------- | ----------- | -------------------------------------------- |
| 인코더의 MHA        | 인코더 입력 | 인코더 입력 | 셀프 어텐션 (Q = K = V)                      |
| 디코더의 Masked MHA | 디코더 입력 | 디코더 입력 | 셀프 어텐션 (Q = K = V), 마스크 적용         |
| 디코더의 MHA        | 디코더 벡터 | 인코더 출력 | 셀프 어텐션이 아님 (Q와 K = V의 출처가 다름) |

![인코더 MHA, 디코더 Masked MHA, 디코더 MHA 세 층에서 Q, K, V가 어느 입력에서 오는지 비교한 도식](./images/dl-transformer-attention-types.svg '셀프 어텐션은 Q, K, V가 같은 문장에서 오는 경우이고, 디코더의 두 번째 MHA는 Q만 디코더에서 가져온다')

> [!NOTE]
> 셀프 어텐션은 기본적으로 Query, Key, Value가 같은 경우를 가리킨다. 디코더의 두 번째 MHA는 Query가 디코더 벡터이고 Key = Value가 인코더 벡터라서 셀프 어텐션이라 하지 않고, 인코더와 디코더 사이의 어텐션을 담당한다.

## 인코더의 동작

### 단어 임베딩과 위치 인코딩

단어 임베딩(word embedding)은 단어를 `d_{model}{:math}` 차원 벡터로 바꾼다. `T{:math}`개 단어로 된 문장을 한꺼번에 입력하려고 `T \times d_{model}{:math}` 크기의 행렬 `\mathbf{S}{:math}`로 표현한다.

RNN은 단어를 순서대로 처리하지만 트랜스포머는 모든 단어를 동시에 넣으므로 순서 정보가 따로 필요하다. 위치 정보를 표현한 행렬 `\mathbf{P}{:math}`를 `\mathbf{S}{:math}`에 더해 입력 행렬 `\mathbf{X}{:math}`를 만든다. 세 행렬 모두 `T \times d_{model}{:math}` 크기다.

```math
\mathbf{X} = \mathbf{S} + \mathbf{P}
```

![단어 I, am, a, student의 임베딩 벡터 S 위에 위치 인코딩 P를 더해 X를 만드는 그림](./images/dl-transformer-04.jpg '단어마다 임베딩 벡터에 같은 크기의 위치 인코딩 벡터를 원소별로 더한다 (강의 자료)')

`\mathbf{P}{:math}`는 삼각함수로 만든다. 위치 `pos{:math}`의 단어에서 짝수 번째 차원은 사인, 홀수 번째 차원은 코사인 값을 쓴다.

```math
p_{pos,2i} = \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right), \qquad
p_{pos,2i+1} = \cos\left(\frac{pos}{10000^{2i/d_{model}}}\right)
```

![위치 인코딩 행렬 P의 (pos, i) 원소를 단어 임베딩 행렬에 더하는 그림](./images/dl-transformer-06.jpg '행은 단어의 위치 pos, 열은 차원 i이고 P의 (pos, i) 원소를 같은 자리에 더한다 (강의 자료)')

차원 번호 `i{:math}`가 작을수록 분모가 작아 주기가 짧고, 클수록 주기가 길다. 그래서 각 위치는 주기가 다른 사인·코사인 값의 조합으로 고유한 패턴을 갖는다.

![T=6, d_model=8인 경우 S 행렬, 위치 인코딩 행렬 P의 히트맵, pos=2와 pos=3 행의 값을 그린 그래프](./images/dl-transformer-05.jpg 'T=6, d_model=8: pos=2와 pos=3 행의 값 패턴이 서로 다르다 (강의 자료)')

![T=10, d_model=64인 경우 위치 인코딩 행렬의 히트맵과 pos=2, pos=3 행의 그래프](./images/dl-transformer-07.jpg 'T=10, d_model=64: 앞쪽 차원은 위치에 따라 값이 크게 바뀌고 뒤쪽 차원은 거의 일정하게 반복된다 (강의 자료)')

==위치 인코딩을 더하면 같은 단어라도 문장 안의 위치에 따라 트랜스포머에 들어가는 벡터 값이 달라지므로, 트랜스포머의 입력은 순서 정보가 반영된 임베딩 벡터가 된다.==

<details>
<summary>그래프의 첫 값 검산</summary>

`d_{model} = 8{:math}`, `pos = 2{:math}`에서 0번 차원은 `\sin(2/10000^0) = \sin 2 \approx 0.909{:math}`, 1번 차원은 `\cos 2 \approx -0.416{:math}`이다. 그림의 pos = 2 그래프가 0.9 근처에서 시작해 −0.4 근처로 내려가는 모양과 맞는다. pos = 3이면 `\sin 3 \approx 0.141{:math}`, `\cos 3 \approx -0.990{:math}`이라 그래프가 0.14에서 −1.0으로 떨어진다.

</details>

### 셀프 어텐션

`\mathbf{X}{:math}` 행렬에 대한 셀프 어텐션은 인코더의 MHA가 실행한다. 5편의 어텐션에서는 query가 벡터 하나였지만, 여기서는 `T{:math}`개 단어 각각이 query이므로 query를 행렬 `\mathbf{Q}{:math}`로 확장한다.

```math
\mathbf{C} = \underbrace{\mathrm{softmax}(\mathbf{Q}\mathbf{K}^\mathsf{T})}_{\text{주목 행렬}}\,\mathbf{V}
```

`\mathbf{C}{:math}`를 문맥 행렬, softmax 부분을 주목 행렬(attention 행렬)이라 한다. `\mathbf{Q}{:math}`, `\mathbf{K}{:math}`, `\mathbf{V}{:math}`를 모두 `\mathbf{X}{:math}`로 두는 방법이 가장 단순하지만, 실제로는 query, key, value가 각자의 가중치 `\mathbf{W}^Q{:math}`, `\mathbf{W}^K{:math}`, `\mathbf{W}^V{:math}`로 `\mathbf{X}{:math}`를 변환해 쓴다. 이 가중치 행렬은 모두 학습으로 알아낸다.

```math
\mathbf{C} = \mathrm{softmax}\left(\frac{\mathbf{Q}\mathbf{K}^\mathsf{T}}{\sqrt{d_{key}}}\right)\mathbf{V},
\qquad \mathbf{Q} = \mathbf{X}\mathbf{W}^Q,\ \mathbf{K} = \mathbf{X}\mathbf{W}^K,\ \mathbf{V} = \mathbf{X}\mathbf{W}^V
```

| 행렬                                                | 크기                                |
| --------------------------------------------------- | ----------------------------------- |
| `\mathbf{W}^Q, \mathbf{W}^K{:math}`                 | `d_{model} \times d_{key}{:math}`   |
| `\mathbf{W}^V{:math}`                               | `d_{model} \times d_{value}{:math}` |
| `\mathbf{Q}, \mathbf{K}{:math}`                     | `T \times d_{key}{:math}`           |
| `\mathbf{V}{:math}`                                 | `T \times d_{value}{:math}`         |
| `\mathbf{Q}\mathbf{K}^\mathsf{T}{:math}`, 주목 행렬 | `T \times T{:math}`                 |

논문은 `d_{key} = d_{value} = d_{model}/h = 512/8 = 64{:math}`로 둔다. `h{:math}`는 병렬로 처리하는 헤드의 개수다.

![Scaled Dot-Product Attention 구조도: Q와 K의 MatMul, Scale, Mask(선택), SoftMax, V와의 MatMul](./images/dl-transformer-08.jpg 'Q와 K를 곱하고 √d_key로 나눈 뒤 softmax를 거쳐 V에 곱한다. Mask는 디코더에서만 쓴다 (강의 자료)')

> [!TIP] √d_key로 나누는 까닭
> 내적 `\mathbf{q}\cdot\mathbf{k}{:math}`는 차원 `d_{key}{:math}`가 클수록 값의 크기가 커진다. 값이 크면 softmax가 한 원소에 거의 1을 몰아주어 기울기가 아주 작아지므로, 논문은 `\sqrt{d_{key}}{:math}`로 나눠 크기를 맞춘다. 그래서 이 연산의 이름이 scaled dot-product attention이다.

### 셀프 어텐션 계산 예제

"저게 저절로 붉어질 리 없다"가 입력되고, 단어 임베딩과 위치 인코딩을 거친 `\mathbf{X}{:math}`가 다음과 같다고 가정한다(`T = 5{:math}`, `d_{model} = 4{:math}`). 헤드가 2개(`h = 2{:math}`)라고 가정하면 `d_{key} = d_{value} = d_{model}/h = 2{:math}`이다.

```math
\mathbf{X} = \begin{pmatrix}
0.0 & 0.6 & 0.3 & 0.0 \\
0.1 & 0.9 & 0.0 & 0.0 \\
0.0 & 0.1 & 0.8 & 0.1 \\
0.3 & 0.0 & 0.6 & 0.0 \\
0.0 & 0.1 & 0.0 & 0.9
\end{pmatrix},\quad
\mathbf{W}^Q = \begin{pmatrix} 1 & 0 \\ 1 & 0 \\ 0 & 1 \\ 0 & 3 \end{pmatrix},\quad
\mathbf{W}^K = \begin{pmatrix} 0 & 1 \\ 1 & 0 \\ 1 & 0 \\ 0 & 2 \end{pmatrix},\quad
\mathbf{W}^V = \begin{pmatrix} 1 & 2 \\ 0 & 1 \\ 1 & 0 \\ 0 & 0 \end{pmatrix}
```

학습으로 알아낸 가중치가 위와 같을 때 `\mathbf{Q}{:math}`, `\mathbf{K}{:math}`, `\mathbf{V}{:math}`는 다음과 같다.

```math
\mathbf{Q} = \begin{pmatrix} 0.6 & 0.3 \\ 1.0 & 0.0 \\ 0.1 & 1.1 \\ 0.3 & 0.6 \\ 0.1 & 2.7 \end{pmatrix},\quad
\mathbf{K} = \begin{pmatrix} 0.9 & 0.0 \\ 0.9 & 0.1 \\ 0.9 & 0.2 \\ 0.6 & 0.3 \\ 0.1 & 1.8 \end{pmatrix},\quad
\mathbf{V} = \begin{pmatrix} 0.3 & 0.6 \\ 0.1 & 1.1 \\ 0.8 & 0.1 \\ 0.9 & 0.6 \\ 0.0 & 0.1 \end{pmatrix}
```

`\mathbf{Q}\mathbf{K}^\mathsf{T}{:math}`를 `\sqrt{2}{:math}`로 나눠 행마다 softmax를 적용하면 주목 행렬이 된다.

![QK^T 행렬과 softmax(QK^T/√d_key) 주목 행렬의 값](./images/dl-transformer-09.jpg '주목 행렬의 각 행은 합이 1인 주목 벡터다 (강의 자료)')

주목 행렬의 행은 각 단어의 주목 벡터다. 첫 행 두 번째 열의 0.2024는 첫 단어 '저게'가 두 번째 단어 '저절로'에 0.2024만큼 주목해야 한다는 뜻이다. 마지막 단어 '없다'는 자기 자신에 0.8444를 준다. 주목 행렬에 `\mathbf{V}{:math}`를 곱하면 문맥 행렬이 나온다.

```math
\mathbf{C} = \mathrm{softmax}\left(\frac{\mathbf{Q}\mathbf{K}^\mathsf{T}}{\sqrt{d_{key}}}\right)\mathbf{V} =
\begin{pmatrix} 0.4124 & 0.4945 \\ 0.4405 & 0.5351 \\ 0.2952 & 0.3644 \\ 0.3718 & 0.4455 \\ 0.0907 & 0.1741 \end{pmatrix}
```

<details>
<summary>첫 행 손으로 검산하기</summary>

`\mathbf{q}_1 = (0.6, 0.3){:math}`과 `\mathbf{k}_1 = (0.9, 0.0){:math}`의 내적은 `0.54{:math}`, `\mathbf{k}_5 = (0.1, 1.8){:math}`과의 내적은 `0.06 + 0.54 = 0.60{:math}`이다. 첫 행 `(0.54, 0.57, 0.60, 0.45, 0.60){:math}`을 `\sqrt 2 \approx 1.4142{:math}`로 나누면 `(0.3818, 0.4031, 0.4243, 0.3182, 0.4243){:math}`이고, 지수의 합으로 나눈 softmax 값은 `(0.1982, 0.2024, 0.2067, 0.1859, 0.2067){:math}`이다. 이 가중치로 `\mathbf{V}{:math}`의 첫 열을 가중 평균하면 `0.1982 \cdot 0.3 + 0.2024 \cdot 0.1 + 0.2067 \cdot 0.8 + 0.1859 \cdot 0.9 + 0.2067 \cdot 0.0 = 0.4124{:math}`로 `\mathbf{C}{:math}`의 (1, 1) 원소와 같다.

</details>

다음은 이 예제를 계산하는 NumPy 코드다. 헤드 하나의 셀프 어텐션을 계산한다.

```python
import numpy as np
import scipy.special as sp

def self_attention(X, Wq, Wk, Wv, d_key):  # self attention(single-head)
    Q = np.matmul(X, Wq)
    K = np.matmul(X, Wk)
    V = np.matmul(X, Wv)

    QK = np.matmul(Q, np.transpose(K))
    A = sp.softmax(QK / np.sqrt(d_key), axis=1)  # attention 행렬
    C = np.matmul(A, V)  # 문맥 행렬

    return Q, K, V, A, C

X = np.asarray([[0.0, 0.6, 0.3, 0], [0.1, 0.9, 0.0, 0.0], [0, 0.1, 0.8, 0.1], [0.3, 0.0, 0.6, 0.0], [0.0, 0.1, 0.0, 0.9]])

Wq = np.asarray([[1, 0], [1, 0], [0, 1], [0, 3]])
Wk = np.asarray([[0, 1], [1, 0], [1, 0], [0, 2]])
Wv = np.asarray([[1, 2], [0, 1], [1, 0], [0, 0]])

Q, K, V, A, C = self_attention(X, Wq, Wk, Wv, 2)
```

| 줄                                       | 역할                                                                |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `Q = np.matmul(X, Wq){:python}` 외 2줄   | `\mathbf{X}{:math}`를 세 가중치로 변환해 Q, K, V를 만든다           |
| `np.matmul(Q, np.transpose(K)){:python}` | `T \times T{:math}` 크기의 `\mathbf{Q}\mathbf{K}^\mathsf{T}{:math}` |
| `sp.softmax(..., axis=1){:python}`       | 행 방향 softmax. 행마다 합이 1이 된다                               |
| `C = np.matmul(A, V){:python}`           | 주목 행렬로 V를 가중 평균해 문맥 행렬을 만든다                      |

> [!WARNING]
> 강의 자료의 코드는 마지막 곱셈이 `C=np.matmul(a,V)`로 소문자 `a`를 써서 `NameError`가 난다. 위 코드처럼 attention 행렬 `A`를 곱해야 한다. 고친 코드로 계산하면 슬라이드의 `\mathbf{Q}\mathbf{K}^\mathsf{T}{:math}`, 주목 행렬, 문맥 행렬 값이 소수 넷째 자리까지 모두 같게 나온다.

### 멀티 헤드 어텐션

멀티 헤드 어텐션(Multi-head Attention, MHA)은 헤드를 여러 개 갖는다. 논문 기준으로는 512차원의 단어 벡터를 8로 나눈 64차원의 Q, K, V로 바꿔 어텐션을 수행한다. 각 헤드는 고유한 변환 행렬 `\mathbf{W}_i^Q, \mathbf{W}_i^K, \mathbf{W}_i^V{:math}`로 셀프 어텐션을 독립적으로 수행하고, ==헤드끼리 서로 다른 관계를 포착해 상호 보완하므로 헤드 하나보다 성능이 좋다.==

![Multi-Head Attention 구조도: V, K, Q가 각각 Linear를 거쳐 h개의 Scaled Dot-Product Attention으로 들어가고 Concat 뒤 Linear를 지난다](./images/dl-transformer-10.jpg 'h개의 헤드가 각자 어텐션을 계산하고 결과를 이어 붙인 뒤 선형 변환한다 (강의 자료)')

헤드 번호 `i{:math}`를 붙여 식을 다시 쓰면 다음과 같다.

```math
\begin{aligned}
\mathbf{C} &= \mathrm{Concatenate}(\mathbf{C}_1, \mathbf{C}_2, \cdots, \mathbf{C}_h)\,\mathbf{W}^O \\
\mathbf{C}_i &= \mathrm{softmax}\left(\frac{\mathbf{Q}_i\mathbf{K}_i^\mathsf{T}}{\sqrt{d_{key}}}\right)\mathbf{V}_i \\
\mathbf{Q}_i &= \mathbf{X}\mathbf{W}_i^Q,\ \mathbf{K}_i = \mathbf{X}\mathbf{W}_i^K,\ \mathbf{V}_i = \mathbf{X}\mathbf{W}_i^V, \quad i = 1, 2, \cdots, h
\end{aligned}
```

![MHA 식에서 Concatenate 결과가 T×d_model, W^O가 d_model×d_model 크기임을 표시한 그림](./images/dl-transformer-11.jpg '헤드 h개의 T×d_value 결과를 이으면 T×d_model이 되고, d_model×d_model 크기의 W^O를 곱한다 (강의 자료)')

헤드가 두 개(`h = 2{:math}`)이고 두 헤드의 문맥 행렬이 다음과 같다고 가정한다. `\mathbf{C}_1{:math}`은 앞 절에서 계산한 행렬이다.

```math
\mathbf{C}_1 = \begin{pmatrix} 0.4124 & 0.4945 \\ 0.4405 & 0.5351 \\ 0.2952 & 0.3644 \\ 0.3718 & 0.4455 \\ 0.0907 & 0.1741 \end{pmatrix},\quad
\mathbf{C}_2 = \begin{pmatrix} 0.3735 & 0.2168 \\ 0.2987 & 0.1578 \\ 0.5436 & 0.4045 \\ 0.5548 & 0.3964 \\ 0.5436 & 0.4045 \end{pmatrix}
```

두 행렬을 열 방향으로 이어 붙이면 `5 \times 4{:math}` 행렬이 되고, `4 \times 4{:math}` 행렬 `\mathbf{W}^O{:math}`를 곱하면 최종 문맥 행렬 `\mathbf{C}{:math}`가 된다.

![Concatenate(C1, C2)에 4×4 행렬 W^O를 곱해 5×4 문맥 행렬 C를 얻는 계산](./images/dl-transformer-12.jpg '이어 붙인 행렬에 W^O를 곱해 입력 X와 같은 T×d_model 크기로 돌려놓는다 (강의 자료)')

> [!NOTE]
> 직접 곱해 보면 결과는 슬라이드와 같고, (5, 1) 원소만 반올림 차이로 0.3374가 아니라 0.3375가 나온다(`0.0907 \cdot 0.1 + 0.1741 \cdot 0.1 + 0.5436 \cdot 0.2 + 0.4045 \cdot 0.5 = 0.33745{:math}`).

### Add & Norm 층

Add는 잔차 연결이고 Norm은 층 정규화다. MHA의 입력 `\mathbf{X}{:math}`와 출력 `\mathbf{C}{:math}`를 더한 뒤 정규화한다.

```math
\mathbf{X}' = \mathrm{Norm}(\mathbf{X} + \mathbf{C}) = \mathrm{Norm}(\mathbf{X} + \mathrm{MHA}(\mathbf{X}))
```

![층 정규화와 배치 정규화가 정규화하는 범위를 미니 배치 N개의 3차원 블록에 색칠해 비교한 그림](./images/dl-transformer-13.jpg '층 정규화는 샘플 하나의 모든 특징을, 배치 정규화는 특징 하나를 미니 배치 전체에 걸쳐 정규화한다 (강의 자료)')

| 정규화                           | 평균·분산을 구하는 범위          | 특징                                             |
| -------------------------------- | -------------------------------- | ------------------------------------------------ |
| 배치 정규화(batch normalization) | 특징 하나를 미니 배치 N개에 걸쳐 | 미니 배치 크기에 영향을 받는다                   |
| 층 정규화(layer normalization)   | 샘플 하나의 모든 특징에 걸쳐     | 샘플마다 독립이라 문장 길이·배치 크기와 무관하다 |

### 위치별 FF 층

위치별 FF 층(position-wise feed-forward layer)은 입력과 출력이 모두 `T \times d_{model}{:math}` 크기의 행렬이다. 기존 완전 연결층은 벡터와 벡터를 연결하는데, 여기서는 `T \times d_{model}{:math}` 행렬의 각 행을 벡터로 간주해 `d_{model}{:math}` 차원 벡터와 `d_{ff}{:math}` 차원 벡터를 연결한다.

```math
\mathbf{X}'' = \mathrm{FFN}(\mathbf{X}') = \mathrm{ReLU}(\mathbf{X}'\mathbf{W}_1 + \mathbf{b}_1)\,\mathbf{W}_2 + \mathbf{b}_2
```

`\mathbf{W}_1{:math}`은 `d_{model} \times d_{ff}{:math}`, `\mathbf{W}_2{:math}`는 `d_{ff} \times d_{model}{:math}` 크기이고 논문은 `d_{ff} = 2048{:math}`이다. 512차원을 2048차원으로 넓혔다가 다시 512차원으로 줄인다. ==같은 `\mathbf{W}_1, \mathbf{W}_2{:math}`를 모든 위치(행)에 똑같이 적용하므로 위치별 FF라고 부른다.== FF 층 뒤에도 Add & Norm이 붙어 `\mathbf{X}'{:math}`와 `\mathbf{X}''{:math}`를 더해 정규화한다.

### 인코더 블록의 가중치 수

논문 설정은 `d_{model} = 512{:math}`, `h = 8{:math}`, `d_{key} = d_{value} = 64{:math}`, `d_{ff} = 2048{:math}`이다.

| 층       | 가중치                                                                                                                                                 | 개수                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| MHA      | `\mathbf{W}_1^Q, \mathbf{W}_1^K, \mathbf{W}_1^V, \cdots, \mathbf{W}_h^Q, \mathbf{W}_h^K, \mathbf{W}_h^V, \mathbf{W}^O{:math}`로 `3h + 1{:math}`개 행렬 | `512 \cdot 64 \cdot 24 + 512 \cdot 512 = 1{,}048{,}576{:math}`       |
| FF       | `\mathbf{W}_1, \mathbf{b}_1, \mathbf{W}_2, \mathbf{b}_2{:math}`                                                                                        | `512 \cdot (2048 + 1) + 2048 \cdot (512 + 1) = 2{,}099{,}712{:math}` |
| 블록 6개 |                                                                                                                                                        | `6 \cdot (1{,}048{,}576 + 2{,}099{,}712) = 18{,}889{,}728{:math}`    |

MHA의 Q, K, V 행렬은 `512 \times 64{:math}` 크기가 헤드 8개마다 3개씩 24개이고, `\mathbf{W}^O{:math}`는 `512 \times 512{:math}`이다. FF의 `(2048 + 1){:math}`과 `(512 + 1){:math}`의 1은 편향이다.

> [!NOTE]
> 이 계산은 강의 자료와 교재의 방식대로 MHA의 편향, 층 정규화의 `\gamma, \beta{:math}`, 단어 임베딩 행렬은 넣지 않은 값이다. 직접 다시 계산해도 1,048,576, 2,099,712, 18,889,728이 그대로 나온다.

## 디코더의 동작

### Masked MHA 층

디코더의 Masked MHA 층은 행렬 일부를 마스크로 가리는 것을 빼면 인코더의 MHA 층과 같다. 마스크는 교사 강요(teacher forcing)와 자기 회귀(autoregressive) 방식의 차이를 극복하려고 쓴다.

| 단계 | 쓸 수 있는 방식              | 트랜스포머가 쓰는 방식 |
| ---- | ---------------------------- | ---------------------- |
| 학습 | 자기 회귀, 교사 강요 중 선택 | 교사 강요              |
| 추론 | 자기 회귀만 가능             | 자기 회귀              |

학습 단계에서는 정답 출력 문장 전체를 한꺼번에 디코더에 넣는다. 이대로 셀프 어텐션을 하면 `i{:math}`번째 단어가 아직 생성되지 않은 뒤쪽 단어까지 주목하게 되어, 한 단어씩 만들어 가는 추론 단계와 동작이 달라진다. 그래서 ==`\mathbf{Q}\mathbf{K}^\mathsf{T}{:math}` 행렬의 대각선 위쪽 요소를 모두 아주 큰 음수로 바꿔, softmax 뒤 그 자리의 주목 값이 0이 되도록 한다.==

```math
\mathrm{masking}(\mathbf{Q}\mathbf{K}^\mathsf{T})_{jk} =
\begin{cases}
(\mathbf{Q}\mathbf{K}^\mathsf{T})_{jk} & k \le j \\
-10^9 & k > j
\end{cases}
```

예를 들어 출력 문장 `<SOS> That can't turn red by itself <EOS>`가 디코더에 입력되고(`T = 8{:math}`), `\mathbf{Q}\mathbf{K}^\mathsf{T}{:math}`가 아래와 같으며 `d_{key} = 2{:math}`라고 가정한다. 마스킹한 행렬의 −는 아주 큰 음수다.

![8×8 QK^T 행렬, 대각선 위를 −로 가린 masking(QK^T), softmax 결과 하삼각 주목 행렬](./images/dl-transformer-14.jpg 'i번째 단어는 그 이전에 나온 단어에만 주목한다 (강의 자료)')

첫 행은 자기 자신에만 1.000을 주고, 둘째 행은 앞의 두 단어에 0.507과 0.493을 나눠 준다. 대각선 위쪽은 모두 0이다.

> [!CAUTION]
> 슬라이드는 −를 "-1.09"라고 적었지만 이는 `-10^9{:math}`(−1.0e9)를 옮기며 생긴 오기다. 마스크 값은 softmax 뒤 0이 되도록 아주 큰 음수여야 하고, −1.09 정도로는 주목 값이 0이 되지 않는다. `-10^9{:math}`로 다시 계산하면 슬라이드의 softmax 결과가 소수 셋째 자리까지 그대로 나온다.

### 인코더-디코더 MHA 층

디코더의 두 번째 MHA 층은 인코더와 연결되어 디코더의 단어가 인코더의 단어에 주목한다. 셀프 어텐션이 아니며, `\mathbf{X}{:math}`가 오는 곳만 다르고 계산 과정은 인코더의 MHA와 같다. query는 `\mathbf{X}_{dec}{:math}`를, key와 value는 `\mathbf{X}_{enc}{:math}`를 쓴다.

```math
\begin{aligned}
\mathbf{C} &= \mathrm{Concatenate}(\mathbf{C}_1, \mathbf{C}_2, \cdots, \mathbf{C}_h)\,\mathbf{W}^O \\
\mathbf{C}_i &= \mathrm{softmax}\left(\frac{\mathbf{Q}_i\mathbf{K}_i^\mathsf{T}}{\sqrt{d_{key}}}\right)\mathbf{V}_i \\
\mathbf{Q}_i &= \mathbf{X}_{dec}\mathbf{W}_i^Q,\ \mathbf{K}_i = \mathbf{X}_{enc}\mathbf{W}_i^K,\ \mathbf{V}_i = \mathbf{X}_{enc}\mathbf{W}_i^V, \quad i = 1, 2, \cdots, h
\end{aligned}
```

![인코더 블록의 출력이 디코더 두 번째 MHA의 K와 V로 들어가고, Q는 디코더의 Masked MHA 출력에서 오는 연결을 표시한 구조도](./images/dl-transformer-15.jpg '인코더 쪽 MHA는 K, V, Q가 모두 같은 입력이고, 디코더 두 번째 MHA는 K와 V만 인코더에서 온다 (강의 자료)')

언어 번역에서는 출력 문장의 정보를 가진 query가 입력 문장의 정보를 가진 key와 value에 얼마나 주목하는지를 계산하는 효과가 있다. 5편의 seq2seq 어텐션이 하던 일을 행렬 단위로 한꺼번에 하는 층이다.

### 디코더 블록의 가중치 수

| 층       | 개수                                                                      |
| -------- | ------------------------------------------------------------------------- |
| MHA 2개  | 각각 인코더 MHA와 같으므로 `2 \cdot 1{,}048{,}576 = 2{,}097{,}152{:math}` |
| FF       | 인코더와 같은 `2{,}099{,}712{:math}`                                      |
| 블록 6개 | `6 \cdot (2{,}097{,}152 + 2{,}099{,}712) = 25{,}181{,}184{:math}`         |

인코더 블록 6개와 합치면 `18{,}889{,}728 + 25{,}181{,}184 = 44{,}070{,}912{:math}`개다.

## 전체 동작

![인코더 블록 1부터 N까지와 디코더 블록 1부터 N까지를 쌓고, 마지막 인코더 블록의 출력이 모든 디코더 블록의 Multi-Head Attention에 연결되며 맨 위에 Linear와 softmax가 있는 그림](./images/dl-transformer-16.jpg 'N개의 인코더 블록과 N개의 디코더 블록(논문은 N=6)으로 구성된 트랜스포머 (강의 자료)')

전체 흐름을 순서대로 적으면 다음과 같다.

1. 입력 문장을 단어 임베딩해 `\mathbf{S}{:math}`를 만들고 위치 인코딩 `\mathbf{P}{:math}`를 더해 `\mathbf{X}{:math}`를 만든다.
2. 인코더 블록 N개가 MHA → Add & Norm → FF → Add & Norm을 반복한다. 각 블록의 입력과 출력은 모두 `T \times d_{model}{:math}` 크기라 블록을 그대로 쌓을 수 있다.
3. 마지막 인코더 블록의 출력 `\mathbf{X}_{enc}{:math}`가 모든 디코더 블록의 두 번째 MHA에 key와 value로 들어간다.
4. 디코더는 `<sos>`부터 시작해 Masked MHA → Add & Norm → MHA(인코더-디코더) → Add & Norm → FF → Add & Norm을 N번 거친다.
5. 마지막 디코더 출력을 Linear 층과 softmax에 통과시켜 다음 단어의 확률을 구하고, `<eos>`가 나올 때까지 반복한다.

> [!IMPORTANT] 정리
> 트랜스포머는 RNN의 순차 처리를 없애고 문장 전체를 행렬 하나로 넣어 셀프 어텐션으로 단어 사이 관계를 계산한다. 순서 정보는 위치 인코딩이, 여러 관점의 관계는 멀티 헤드가, 학습과 추론의 차이는 마스크가 맡는다.

다음 글 [8편](/memo/dl-vision-transformer)에서는 이 트랜스포머의 인코더를 영상 분류에 그대로 옮긴 비전 트랜스포머(ViT)를 다룬다.

[^vaswani]: A. Vaswani et al., "Attention Is All You Need", NeurIPS 2017.
