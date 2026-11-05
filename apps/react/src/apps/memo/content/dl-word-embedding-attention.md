---
title: 단어 임베딩과 seq2seq, 어텐션
date: 2023-10-23
category: CS/딥러닝
series: 딥러닝 및 응용
seriesOrder: 5
summary: 텍스트를 신경망에 넣기 위한 원핫 코드와 단어 임베딩(word2vec, GloVe), 텍스트 전처리와 IMDB 감정 분류, seq2seq와 교사 강요, query-key-value 어텐션과 바다나우 어텐션, 영어-프랑스어 번역 실습을 다룬다.
---

딥러닝 및 응용 연재의 다섯 번째 글로, [앞 글](/memo/dl-rnn)의 순환 신경망으로 텍스트를 다루는 방법을 정리한다. 단어를 벡터로 바꾸는 원핫 코드와 단어 임베딩, 그 벡터로 문장의 감정을 분류하는 IMDB 실습, 문장을 다른 문장으로 바꾸는 seq2seq와 어텐션까지 강의 8·10주차의 내용을 다룬다. 마지막의 어텐션은 [트랜스포머의 셀프 어텐션과 멀티 헤드 어텐션](/memo/dl-transformer)으로 이어진다.

| 순서 | 내용                                                   | 강의   |
| ---- | ------------------------------------------------------ | ------ |
| 1    | 텍스트 데이터, 원핫 코드, 단어 임베딩(word2vec, GloVe) | 8주차  |
| 2    | IMDB 감정 분류, GloVe로 단어 관계 찾기                 | 8주차  |
| 3    | seq2seq, 교사 강요, 어텐션, 번역 실습                  | 10주차 |

## 자연어 처리와 텍스트 데이터

자연어는 일상생활에서 사용하는 언어이고, 자연어 처리(NLP, natural language processing)는 자연어의 의미를 분석해 컴퓨터가 처리할 수 있게 하는 인공지능 분야다. 언어 번역, 음성 인식, 사용자의 감성 분석, 텍스트 분류(스팸 메일 분류, 뉴스 기사 카테고리 분류), 고객 응대 챗봇, 소설이나 시를 쓰는 창작 인공지능 등에 응용한다.

영화평 데이터셋 IMDB의 예제 문장에는 텍스트의 특성이 잘 드러난다.

```text
Once again Mr. Costner has dragged out a movie for far longer than necessary. Aside
from the terrific sea rescue sequences, of which there are very few I just did not
care about any of the characters. Most of us have ghosts in the closet, and Costner's
character are realized early on, and then forgotten until much later, by which time I
did not care. ……
```

| 특성                 | 내용                                                             |
| -------------------- | ---------------------------------------------------------------- |
| 시계열 데이터의 성질 | 시간(순서) 정보가 있고 샘플마다 길이가 다르다                    |
| 텍스트 고유의 특성   | 심한 잡음, 형태소 분석 필요, 구문론과 의미론, 언어마다 다른 특성 |
| 입력 형식            | 신경망에 입력하려면 기호를 수치로 변환해야 한다                  |

### 원핫 코드

말뭉치(corpus) 세 문장을 원핫 코드로 바꾸는 절차다.

```text
Freshman loves python.
We teach python to freshman.
How popular is Python?
```

1. 단어를 수집하고 빈도를 집계한다(대소문자 통합): python(3), freshman(2), loves(1), we(1), teach(1), to(1), how(1), popular(1), is(1).
2. 빈도에 따라 순위를 부여해 딕셔너리를 만든다.
3. 문장을 순위 번호의 열로 바꾼다.
4. 번호를 원핫 코드로 바꾼다.

```python
{'python': 1, 'freshman': 2, 'loves': 3, 'we': 4, 'teach': 5, 'to': 6, 'how': 7, 'popular': 8, 'is': 9}
```

> [!NOTE]
> 슬라이드의 딕셔너리는 `{'python':1, 'freshman':2, 'loves':1, 'we':1, ...}`로 빈도와 순위가 섞여 있다. 순위를 부여한 딕셔너리는 위와 같고, 그래야 아래 숫자 코드 [2 3 1], [4 5 1 6 2], [7 8 9 1]과 맞는다.

| 문장                         | 숫자 코드   | 원핫 코드 (9차원)                                           |
| ---------------------------- | ----------- | ----------------------------------------------------------- |
| Freshman loves python.       | [2 3 1]     | [010000000] [001000000] [100000000]                         |
| We teach python to freshman. | [4 5 1 6 2] | [000100000] [000010000] [100000000] [000001000] [010000000] |
| How popular is Python?       | [7 8 9 1]   | [000000100] [000000010] [000000001] [100000000]             |

원핫 코드에는 두 가지 문제가 있다.

| 문제                          | 내용                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| 메모리 낭비                   | 사전 크기가 크면 대부분이 0인 희소 벡터가 된다. 사전 10000개면 10000차원                  |
| 단어 사이의 관계를 표현 못 함 | 모든 단어 벡터가 서로 직교하므로 king과 queen, bridegroom과 bride의 관계를 표현할 수 없다 |

## 단어 임베딩

==단어 임베딩(word embedding)은 단어를 저차원 공간의 밀집 벡터로 표현하는 기법이다.== 보통 수백 차원을 사용하고, 벡터가 단어의 의미를 표현하며, 그 값을 신경망 학습으로 알아낸다.

| 표현        | "python"의 벡터 (사전 10000개, 임베딩 16차원)      |
| ----------- | -------------------------------------------------- |
| 원핫 코드   | `(1\ 0\ 0\ 0 \cdots 0\ 0\ 0){:math}`, 요소 10000개 |
| 단어 임베딩 | `(0.01\ 0.23\ 0.0 \cdots 0.002){:math}`, 요소 16개 |

![Korea→Seoul과 Spain→Madrid 화살표가 평행하고 movie와 film이 가까이 있는 2차원 임베딩 공간](./images/dl-word-embedding-attention-01.jpg '의미가 비슷한 단어는 가까이 놓이고, 나라와 수도의 관계는 같은 방향의 벡터가 된다 (강의 자료)')

단어를 벡터 공간에 표현하는 아이디어는 오래전부터 연구되었다. 영국의 언어학자 퍼스(J. R. Firth)는 1957년에 "You shall know a word by the company it keeps."라고 썼다. 단어의 의미는 함께 등장하는 단어로 정해진다는 통찰이다. "영화"라는 단어는 "아카데미", "흥행" 같은 단어와 함께 등장할 가능성이 높다.

| 시기     | 기법                                   |
| -------- | -------------------------------------- |
| 1960년대 | TF(term frequency)                     |
| 1980년대 | LSA(latent semantic analysis)          |
| 2000년대 | 신경망 기법들                          |
| 2010년대 | 딥러닝을 활용한 word2vec, GloVe가 주류 |

### word2vec

word2vec(Mikolov 외, 구글, 2013)은 "비슷한 문맥에서 등장하는 단어는 비슷한 의미를 가진다"고 가정한다. 구글이 공개한 사전 학습 모델은 약 1000억 단어 규모의 구글 뉴스 데이터로 학습해 약 300만 개의 단어와 구를 300차원 공간에 표현한다.

> [!NOTE]
> 슬라이드에는 "1000억 개 가량의 뉴스"로 적혀 있지만, 구글 뉴스 데이터셋의 규모는 기사 수가 아니라 단어 수로 약 1000억 개다.

학습 방식은 CBOW와 Skip-gram 두 가지다.

| 방식                          | 입력        | 예측        |
| ----------------------------- | ----------- | ----------- |
| CBOW(Continuous Bag of Words) | 주변 단어들 | 중심 단어   |
| Skip-gram                     | 중심 단어   | 주변 단어들 |

![The fat cat sat on the mat에서 중심 단어를 한 칸씩 옮기며 주변 단어 원핫 벡터를 만든 표와, fat·cat·on·the를 입력해 sat을 예측하는 CBOW 신경망](./images/dl-word-embedding-attention-02.jpg 'CBOW는 윈도우 안의 주변 단어 네 개로 가운데 단어 sat을 예측한다 (강의 자료)')

CBOW 신경망은 입력층, 투사층(projection layer), 출력층으로 이루어진다. 원핫 벡터 `\mathbf{x}{:math}`에 가중치 행렬 `W_{V \times M}{:math}`을 곱하면 `W{:math}`의 한 행이 그대로 선택된다. `V{:math}`는 사전 크기, `M{:math}`은 임베딩 차원이다.

```math
\mathbf{x}_{\text{cat}} \times W_{V \times M} = \mathbf{v}_{\text{cat}}
```

![cat의 원핫 벡터와 W를 곱하면 W의 세 번째 행이 선택되고, cat과 on의 벡터를 투사층에서 평균해 W'로 sat을 예측하는 그림](./images/dl-word-embedding-attention-03.jpg '원핫 벡터와 W의 곱은 W의 한 행을 꺼내는 조회(lookup)이고, 그 행이 단어의 M차원 임베딩 벡터다 (강의 자료)')

==학습이 끝난 뒤 `W{:math}`의 각 행이 각 단어의 `M{:math}`차원 임베딩 벡터가 된다.== 투사층은 주변 단어 벡터들의 평균을 계산하고, `W'_{M \times V}{:math}`와 소프트맥스로 중심 단어의 확률을 출력한다.

![중심 단어 cat과 sat에 대해 주변 단어 쌍을 만든 Skip-gram 데이터셋과, sat 하나로 fat·cat·on·the를 예측하는 신경망](./images/dl-word-embedding-attention-04.jpg '윈도우 크기 2이면 중심 단어 하나에 (중심, 주변) 쌍이 네 개 생긴다 (강의 자료)')

Skip-gram은 중심 단어 하나로 주변 단어 여럿을 예측한다. 윈도우 크기가 2이면 "The fat cat sat on the mat"에서 중심 단어 cat에 대해 (cat, The), (cat, fat), (cat, sat), (cat, on) 네 쌍이 생긴다. 전반적으로 Skip-gram이 CBOW보다 성능이 좋다고 알려져 있다.

### GloVe

GloVe(Global Vectors, Pennington, Socher, Manning, 스탠퍼드 대학, 2014)는 카운트 기반 방법과 예측 기반 방법을 모두 사용하는 단어 임베딩 방법이다. 공개된 glove.6B 모델은 위키피디아(2014)와 Gigaword 5 데이터의 60억 토큰으로 학습해 약 40만 개의 단어를 50, 100, 200, 300차원 공간에 표현한다.

GloVe의 아이디어는 ==임베딩된 중심 단어 벡터와 주변 단어 벡터의 내적이 전체 말뭉치에서의 동시 등장 확률(의 로그)이 되도록 만드는 것==이다. `X_{ij}{:math}`를 단어 `i{:math}`의 문맥에 단어 `j{:math}`가 등장한 횟수라 하면 다음 관계를 목표로 학습한다.

```math
\mathbf{w}_i^{\top}\tilde{\mathbf{w}}_j + b_i + \tilde{b}_j = \log X_{ij}
```

word2vec이 윈도우 안의 지역 문맥만 사용하는 데 비해, GloVe는 말뭉치 전체에서 집계한 동시 등장 행렬 `X{:math}`를 사용한다.

## 텍스트 데이터셋과 전처리

텐서플로는 두 가지 텍스트 데이터셋을 제공한다.

| 데이터셋 | 내용                                              | 주 용도                             |
| -------- | ------------------------------------------------- | ----------------------------------- |
| IMDB     | 영화 댓글 50000개를 긍정·부정으로 레이블링        | 감정 분류(sentiment classification) |
| Reuters  | 로이터 통신 뉴스 11228개를 46개 토픽으로 레이블링 | 토픽 분류                           |

### 전처리 과정

전처리는 토큰화(tokenization), 정제(cleaning), 정규화(normalization)로 이루어진다.

토큰화는 텍스트를 토큰(token)이라는 단위로 나누는 작업이다. 단어 토큰화는 단어를 기준으로, 마침표(.), 쉼표(,), 물음표(?), 세미콜론(;), 느낌표(!) 같은 구분 기호로 텍스트를 나눈다. 입력 "Time is an illusion. Lunchtime double so!"의 출력은 "Time", "is", "an", "illusion", "Lunchtime", "double", "so"다.

```python
# 영문 단어 토큰화 함수들
from nltk.tokenize import word_tokenize
from nltk.tokenize import WordPunctTokenizer
from tensorflow.keras.preprocessing.text import text_to_word_sequence

sent = "Don't be fooled by the dark sounding name, Mr. Jone's Orphanage is as cheery as goes for a pastry shop."
print('단어 토큰화1 :', word_tokenize(sent))
print('단어 토큰화2 :', WordPunctTokenizer().tokenize(sent))
print('단어 토큰화3 :', text_to_word_sequence(sent))
```

```python
# 한글 단어 토큰화 함수들
from konlpy.tag import Okt
from konlpy.tag import Kkma
okt = Okt()
kkma = Kkma()
print('OKT 형태소 분석 :', okt.morphs("열심히 코딩한 당신, 연휴에는 여행을 가봐요"))
print('OKT 품사 태깅 :', okt.pos("열심히 코딩한 당신, 연휴에는 여행을 가봐요"))
print('OKT 명사 추출 :', okt.nouns("열심히 코딩한 당신, 연휴에는 여행을 가봐요"))
```

세 영문 토큰화 함수는 아포스트로피를 다르게 처리한다. `word_tokenize`는 Don't를 Do와 n't로, `WordPunctTokenizer`는 구두점을 모두 별도 토큰으로 분리하고, `text_to_word_sequence`는 소문자로 바꾸고 아포스트로피를 제외한 구두점을 제거한다. 한국어는 조사와 어미가 단어에 붙으므로 띄어쓰기만으로 토큰화할 수 없어 형태소 분석기(Okt, Kkma)를 사용한다.

정제는 말뭉치에서 노이즈 데이터를 제거하는 작업이다.

| 작업                       | 예                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 대소문자 통합              | Python, python을 같은 단어로                                                                                                      |
| 불필요한 단어 제거         | 특수 문자처럼 의미 없는 글자, 목적에 맞지 않는 문장과 단어                                                                        |
| 불용어·빈도·길이 기준 제거 | 의미 없는 단어(불용어), 등장 빈도가 적은 단어, 길이가 짧은 단어. 영어는 2~3글자 이하인 it, at, to, on, in, by 등을 제거할 수 있다 |

```python
import nltk
nltk.download('stopwords')
from nltk.corpus import stopwords
stopwords.words('english')[:10]
# ['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're"]

import re
text = "I was wondering if anyone out there could enlighten me on this car."

# 길이가 1~2인 단어들을 정규 표현식을 이용하여 삭제
shortword = re.compile(r'\W*\b\w{1,2}\b')
print(shortword.sub('', text))
```

정규식 `\W*\b\w{1,2}\b`는 앞의 공백과 함께 글자 수가 1~2개인 단어(I, if, me, on)를 찾아 빈 문자열로 바꾼다.

정규화는 표현 방법이 다른 단어들을 통합해 같은 단어로 만드는 작업이다.

| 방법                       | 동작                                                           | 예                                                           |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| 어간 추출(stemming)        | 접사를 규칙으로 잘라 단어의 의미를 담은 핵심 부분(어간)만 남김 | formalize → formal, allowance → allow, electrical → electric |
| 표제어 추출(lemmatization) | 사전의 기본형(표제어)으로 바꿈                                 | am, are, is → be                                             |

> [!NOTE]
> 슬라이드는 어간 추출을 "단어의 의미를 담고 있는 핵심 부분", 표제어 추출을 "단어에 추가적인 의미를 주는 부분 제거"로 설명하는데, 앞의 것은 어간(stem), 뒤의 것은 접사(affix)의 설명이다. 위 표처럼 어간 추출은 접사를 잘라 어간을 남기는 방법이고, 표제어 추출은 품사 정보를 사용해 기본형을 찾는 방법이다. 예의 electricical은 electrical의 오타다.

## IMDB 실습

### 데이터 확인

```python
import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras.datasets import imdb

(X_train, y_train), (X_test, y_test) = imdb.load_data()

print('훈련용 리뷰 개수 : {}'.format(len(X_train)))
print('테스트용 리뷰 개수 : {}'.format(len(X_test)))
num_classes = len(set(y_train))
print('카테고리 : {}'.format(num_classes))

word2id = imdb.get_word_index()
id2word = {word: id for id, word in word2id.items()}

for i in range(1, 21):
    print(id2word[i], end='/')

print('첫번째 훈련용 리뷰 :', X_train[0])
print('첫번째 훈련용 리뷰의 레이블 :', y_train[0])
```

```text
훈련용 리뷰 개수 : 25000
테스트용 리뷰 개수 : 25000
카테고리 : 2
the/and/a/of/to/is/br/in/it/i/this/that/was/as/for/with/movie/but/film/on/
첫번째 훈련용 리뷰 : [1, 14, 22, 16, 43, 530, 973, 1622, 1385, 65, 458, 4468, 66, 3941, 4, 173, 36, ...
첫번째 훈련용 리뷰의 레이블 : 1
```

IMDB는 토큰화와 정수 인코딩이 끝난 상태로 제공된다. 단어 번호는 빈도 순위이므로 1번이 the, 2번이 and다. 컴프리헨션의 변수 이름 `id, word`가 실제 값(단어, 번호)과 반대로 붙어 있지만, 결과 딕셔너리 `id2word`는 이름대로 번호를 키로, 단어를 값으로 가진다. `load_data()`는 기본값으로 시작 표시(1), 사전 밖 단어(2)를 위해 번호를 3만큼 밀어 저장하므로, 리뷰의 번호를 단어로 바꿀 때는 3을 빼야 한다. 레이블 1은 긍정, 0은 부정이다. br은 리뷰 HTML에 들어 있던 줄 바꿈 태그가 단어로 남은 것이다.

### 임베딩층과 다층 퍼셉트론

```python
from tensorflow.keras.datasets import imdb
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Flatten, Embedding
from tensorflow.keras import preprocessing

dic_siz = 10000   # 사전의 크기(사전에 있는 단어 개수)
sample_siz = 512  # 샘플의 크기

# tensorflow가 제공하는 간소한 버전의 IMDB 읽기
(x_train, y_train), (x_test, y_test) = imdb.load_data(num_words=dic_siz)

embed_space_dim = 16  # 16차원의 임베딩 공간

# padding으로 서로 다른 문장의 길이를 맞춰주는 것
# 동일하게 0을 패딩하게 되는데, 문장 앞쪽에 패딩을 수행함
x_train = preprocessing.sequence.pad_sequences(x_train, maxlen=sample_siz)
x_test = preprocessing.sequence.pad_sequences(x_test, maxlen=sample_siz)

# 신경망 모델 설계와 학습
embed = Sequential()
# input_dim 차원을 output_dim 차원으로 축소 시킴
embed.add(Embedding(input_dim=dic_siz, output_dim=embed_space_dim, input_length=sample_siz))
embed.add(Flatten())
embed.add(Dense(32, activation='relu'))
embed.add(Dense(1, activation='sigmoid'))
embed.compile(loss='binary_crossentropy', optimizer='Adam', metrics=['accuracy'])
hist = embed.fit(x_train, y_train, epochs=20, batch_size=64, validation_data=(x_test, y_test), verbose=2)

embed.summary()

# 모델 평가
res = embed.evaluate(x_test, y_test, verbose=0)
print("정확률은", res[1] * 100)
```

| 줄                                       | 의미                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `load_data(num_words=10000)`             | 빈도 상위 10000개 단어만 남기고 나머지는 사전 밖 단어로 처리               |
| `pad_sequences(maxlen=512)`              | 길이를 512로 맞춘다. 짧으면 앞쪽에 0을 채우고, 길면 앞쪽을 잘라 낸다       |
| `Embedding(10000, 16, input_length=512)` | 단어 번호를 16차원 벡터로 바꾸는 조회 표(10000×16). 출력 `(None, 512, 16)` |
| `Flatten()`                              | `512 \times 16 = 8192{:math}`차원으로 일렬로 펼친다                        |
| `Dense(32)`, `Dense(1, sigmoid)`         | 다층 퍼셉트론으로 긍정 확률 하나를 출력                                    |

Embedding층의 가중치가 앞의 `W_{V \times M}{:math}`이고, 분류 문제를 학습하는 과정에서 함께 학습된다.

| 층        | 출력 모양       | 파라미터                              |
| --------- | --------------- | ------------------------------------- |
| Embedding | (None, 512, 16) | `10000 \times 16 = 160000{:math}`     |
| Flatten   | (None, 8192)    | 0                                     |
| Dense     | (None, 32)      | `8192 \times 32 + 32 = 262176{:math}` |
| Dense     | (None, 1)       | `32 + 1 = 33{:math}`                  |
| 합계      |                 | 422209                                |

![20 epoch 학습 로그, 모델 요약, 정확률 86.668, 훈련 정확률은 1.0에 붙고 검증 정확률은 0.87 근처에 머무는 학습 곡선](./images/dl-word-embedding-attention-12.jpg '훈련 정확률은 4 epoch 만에 1.0이 되지만 검증 정확률은 0.87에서 더 오르지 않는다 (발표 자료)')

25000개 샘플을 배치 64로 나누면 `\lceil 25000/64 \rceil = 391{:math}`단계다. 테스트 정확률은 86.67%이고, 훈련 손실이 `1.6 \times 10^{-5}{:math}`까지 내려가는 동안 검증 손실은 0.76까지 올라간다. 전형적인 과대적합이다.

### LSTM을 통한 분류

```python
from tensorflow.keras.layers import Dense, LSTM, Embedding
from tensorflow.keras.callbacks import EarlyStopping

# (데이터 읽기와 패딩은 앞과 같다)

# 검증 집합에 대한 정확률을 조기 멈춤 기준으로 사용
# 5 세대 동안 성능 향상 없으면 멈춤
# 가장 높은 성능을 발휘했을 때의 가중치를 취함
early = EarlyStopping(monitor='val_accuracy', patience=5, restore_best_weights=True)

# 신경망 모델의 설계와 학습(LSTM 층 포함)
embed = Sequential()
embed.add(Embedding(input_dim=dic_siz, output_dim=embed_space_dim, input_length=sample_siz))
embed.add(LSTM(units=32))
embed.add(Dense(1, activation='sigmoid'))
embed.compile(loss='binary_crossentropy', optimizer='Adam', metrics=['accuracy'])
# 훈련 집합의 20%를 떼어 검증 집합으로 사용
# 콜백 함수를 통해 조기 멈춤 적용
hist = embed.fit(x_train, y_train, epochs=20, batch_size=64, validation_split=0.2, verbose=2, callbacks=[early])
```

`Flatten`과 `Dense(32)` 대신 `LSTM(32)`가 512개 단어를 차례로 읽고 마지막 은닉 상태만 출력한다. 파라미터는 Embedding 160000, LSTM 6272, Dense 33으로 합계 166305개다. `validation_split=0.2`로 훈련 데이터 25000개 가운데 20000개로 학습하고 5000개로 검증하므로, 배치 수는 `\lceil 20000/64 \rceil = 313{:math}`이다.

![10 epoch에서 조기 멈춤한 LSTM 학습 로그와 모델 요약, 정확률 86.468, 학습 곡선](./images/dl-word-embedding-attention-13.jpg '검증 정확률이 5 epoch(0.8764)에서 가장 높았고, 이후 5 epoch 동안 오르지 않아 10 epoch에서 멈췄다 (발표 자료)')

발표 자료의 실행에서는 5 epoch의 검증 정확률 0.8764가 최고였고, 6~10 epoch에서 이를 넘지 못해 학습이 멈췄다. `restore_best_weights=True`이므로 5 epoch의 가중치로 평가한 테스트 정확률은 86.47%다. 강의 자료의 실행에서는 3 epoch(0.8784)가 최고였고 8 epoch에서 멈춰 86.76%가 나왔다.

| 모델                        | 파라미터 | 테스트 정확률 (강의) | 테스트 정확률 (발표) |
| --------------------------- | -------- | -------------------- | -------------------- |
| Embedding + Flatten + Dense | 422209   | 86.88%               | 86.67%               |
| Embedding + LSTM            | 166305   | 86.76%               | 86.47%               |

> [!IMPORTANT] 두 모델 모두 문장의 의미를 파악하지 못한다
> LSTM이 다층 퍼셉트론보다 낫지 않다. 두 프로그램 모두 boring, terrible, bad가 많으면 부정, wonderful, good이 자주 나타나면 긍정으로, 사실상 단어의 빈도에 따라 분류한다. "To me all of the movies are terrible, but this one is not."은 긍정 문장이지만 terrible이 있다는 이유로 두 프로그램 모두 부정으로 분류한다.

### GloVe로 연관 관계 찾기

사전 학습된 GloVe 벡터를 내려받아 단어 사이의 거리를 계산한다.

```python
from urllib.request import urlretrieve, urlopen
import gzip
import zipfile

urlretrieve("http://nlp.stanford.edu/data/glove.6B.zip", filename="glove.6B.zip")
zf = zipfile.ZipFile('glove.6B.zip')
zf.extractall()
zf.close()

import numpy as np
from scipy.spatial import distance  # 거리 계산용 함수

dictionary = {}  # 빈 딕셔너리 생성

f = open('glove.6B.100d.txt', encoding="utf8")

for line in f:
    word_vector = line.split()
    word = word_vector[0]

    # 100개의 값을 가지는 array로 변환
    word_vector_arr = np.asarray(word_vector[1:], dtype='float32')
    dictionary[word] = word_vector_arr
f.close()

print('%s개의 Embedding vector가 있습니다.' % len(dictionary))
print(dictionary['class'])
print('벡터의 차원 수 :', len(dictionary['class']))
```

```text
400000개의 Embedding vector가 있습니다.
[ 0.44507    1.1348     0.33681    0.033357  -1.0405     0.24413 ...
 -0.080935  -0.70294    0.47778   -0.33316  ]
벡터의 차원 수 : 100
```

`glove.6B.100d.txt`는 한 줄에 단어 하나와 100개의 실수가 공백으로 구분되어 있다. 강의 자료의 코드는 마지막 두 줄에서 `embedding_dict['class']`를 사용해 딕셔너리 이름이 맞지 않으므로, 위처럼 `dictionary`로 고쳐야 실행된다.

```python
# 가장 가까운 단어를 찾아주는 함수
def find_closest_words(vector):
    return sorted(dictionary.keys(), key=lambda w: distance.euclidean(dictionary[w], vector))

# 가까운 단어 찾기
print(find_closest_words(dictionary['movie'])[:5])
print(find_closest_words(dictionary['school'])[:5])
print(find_closest_words(dictionary['oak'])[:5])

# 단어 추론
print(find_closest_words(dictionary["seoul"] - dictionary["korea"] + dictionary["spain"])[:5])
print(find_closest_words(dictionary["animal"] - dictionary["lion"] + dictionary["oak"])[:5])
print(find_closest_words(dictionary["queen"] - dictionary["king"] + dictionary["actress"])[:5])
```

![가까운 단어와 단어 추론 코드, 기대하는 결과 Madrid, tree, actor, 그리고 실제 출력 여섯 줄](./images/dl-word-embedding-attention-14.jpg '단어 벡터의 덧셈·뺄셈으로 수도, 상위 범주, 성별 관계를 추론한다 (강의 자료)')

| 질의                   | 가까운 단어 5개 (유클리드 거리)                |
| ---------------------- | ---------------------------------------------- |
| movie                  | movie, film, movies, films, hollywood          |
| school                 | school, college, schools, elementary, students |
| oak                    | oak, pine, cedar, walnut, grove                |
| seoul - korea + spain  | madrid, spain, santiago, seville, valencia     |
| animal - lion + oak    | oak, trees, woodland, wood, organic            |
| queen - king + actress | actress, actresses, dancer, actor, comedienne  |

seoul - korea + spain의 1위는 기대한 대로 madrid다. 나머지 두 추론은 기대값(tree, actor)이 1위가 아니다. 계산식에 들어간 단어(oak, actress)가 결과 벡터와 가장 가까워 1위를 차지했기 때문이고, 그 단어를 빼면 animal - lion + oak는 trees, queen - king + actress는 actresses, dancer 다음에 actor가 온다. 단어 추론 실험에서는 보통 입력 단어를 후보에서 제외한다.

## seq2seq

==seq2seq(sequence-to-sequence)는 입력 시퀀스로부터 다른 도메인의 시퀀스를 출력하는 모델이다.== 서츠케버(Sutskever, Vinyals, Le)가 2014년에 발표한 자연어 처리 분야의 획기적 아이디어로, 챗봇과 기계 번역에 사용한다. 가변 길이의 문장을 가변 길이의 문장으로 변환한다.

| 구성                          | 역할                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| 인코더(encoder)               | 입력 문장의 모든 단어를 순차적으로 입력받는 RNN(LSTM)                                     |
| 컨텍스트 벡터(context vector) | 인코더가 모든 단어를 읽은 뒤 마지막에 그 정보를 압축해 만든 하나의 벡터(마지막 은닉 상태) |
| 디코더(decoder)               | 컨텍스트 벡터를 받아 번역된 단어를 한 개씩 순차적으로 출력하는 RNN(LSTM)                  |
| `<sos>`, `<eos>`              | 문장의 시작과 끝을 의미하는 심볼                                                          |

![I am a student를 읽는 LSTM 인코더, 단어 임베딩 표, CONTEXT, sos부터 je suis étudiant eos를 출력하는 LSTM 디코더와 Dense·softmax 층](./images/dl-word-embedding-attention-06.jpg '인코더의 마지막 은닉 상태가 컨텍스트 벡터가 되어 디코더의 초기 상태로 전달된다 (강의 자료)')

인코더의 각 단어는 임베딩층을 거쳐 밀집 벡터(그림의 I = (0.157, -0.25, 0.478, -0.78) 같은 4차원 벡터)로 입력된다. 디코더는 매 시점 은닉 상태를 Dense층과 소프트맥스에 통과시켜 사전의 모든 단어에 대한 확률을 얻고, 가장 확률이 높은 단어를 출력한다.

### 교사 강요

==교사 강요(teacher forcing)는 훈련 과정에서 이전 시점의 디코더 출력 대신 이전 시점의 실제값(정답)을 현재 시점의 디코더 입력으로 주는 방법이다.== 이전 시점의 예측이 틀렸을 때 잘못된 정보가 계속 입력되면 연쇄 작용으로 디코더 전체의 예측이 어려워지기 때문이다.

![저게 저절로 붉어질 리 없다를 읽은 인코더 h1~h5 뒤에, 회색 영역의 정답 단어를 디코더 g2~g7의 입력으로 넣는 학습 단계](./images/dl-word-embedding-attention-05.jpg '학습 단계에서는 회색 영역의 정답 단어(That, can′t, …)를 디코더에 입력한다 (강의 자료)')

| 단계            | 디코더의 다음 시점 입력          |
| --------------- | -------------------------------- |
| 학습(교사 강요) | 정답 단어 (ground truth)         |
| 추론(자기 회귀) | 이전 시점에 디코더가 출력한 단어 |

## 어텐션

### seq2seq의 문제

RNN에 기반한 seq2seq 모델에는 두 가지 문제가 있다.

| 문제        | 내용                                                                              |
| ----------- | --------------------------------------------------------------------------------- |
| 정보 손실   | 하나의 고정된 크기의 벡터(컨텍스트 벡터)에 모든 정보를 압축하므로 정보가 손실된다 |
| 기울기 소실 | RNN의 고질적인 문제인 기울기 소실(vanishing gradient)이 그대로 존재한다           |

==어텐션(attention)은 디코더가 출력 단어를 예측하는 매 시점마다 인코더의 전체 입력 문장을 다시 한번 참고하되, 해당 시점에 예측할 단어와 연관이 있는 입력 단어에 더 집중하는 방법이다.== query-key-value 방식이 주류다.

![seq2seq는 h5 하나를 고정된 문맥 벡터로 쓰고, 어텐션은 h1~h5의 가중합으로 시점마다 새 문맥 벡터를 만드는 비교 도식](./images/dl-word-embedding-attention-context.svg 'seq2seq는 마지막 은닉 상태 하나에 의존하고, 어텐션은 디코더 시점마다 인코더 전체를 다시 조회한다')

### query-key-value

==어텐션 함수는 주어진 쿼리(query)에 대해 모든 키(key)와의 유사도를 각각 구하고, 이 유사도를 각각의 값(value)에 반영해 더한 값(attention value)을 출력한다.==

```math
\mathrm{Attention}(Q, K, V) = \text{Attention Value}
```

계산은 세 단계다.

1. query `\mathbf{q}{:math}`와 `i{:math}`번째 key `\mathbf{k}_i{:math}`의 유사도 `s_i{:math}`를 내적 `\mathbf{q}\mathbf{k}_i^{\top}{:math}`로 계산한다.
2. 유사도 벡터 `\mathbf{s} = (s_1, s_2, s_3, s_4){:math}`에 소프트맥스를 적용해 주목 벡터(attention vector) `\mathbf{a}{:math}`를 계산한다. 원소의 합이 1이 된다.
3. 주목 벡터 `\mathbf{a}{:math}`를 가중치로 사용해 value의 가중합, 즉 문맥 벡터(context vector) `\mathbf{c}{:math}`를 계산한다.

![query 하나와 key 네 개의 유사도, 소프트맥스로 얻은 주목 벡터, value 네 개의 가중합으로 얻은 문맥 벡터](./images/dl-word-embedding-attention-07.jpg 'q는 세 번째 key k3과 가장 유사하므로 세 번째 value v3에 가장 많이 주목한다 (강의 자료)')

행렬로 쓰면 key와 value를 행으로 쌓은 `K{:math}`, `V{:math}`로 한 줄에 표현된다.

```math
\mathbf{q} = (0.990\ \ 0.099\ \ 0.099), \quad
K = \begin{pmatrix} 0.050 & 0.000 & 0.998 \\ 0.020 & 0.020 & 0.999 \\ 0.976 & 0.098 & 0.195 \\ 0.020 & 0.999 & 0.020 \end{pmatrix}, \quad
V = \begin{pmatrix} 1 & 2 & 5 \\ 1 & 1 & 5 \\ 3 & 2 & 4 \\ 6 & 1 & 2 \end{pmatrix}
```

```math
\mathbf{c} = \mathrm{softmax}(\mathbf{q}K^{\top})V
```

직접 다시 계산한 값이다.

| 단계                                                         | 값                           |
| ------------------------------------------------------------ | ---------------------------- |
| 유사도 `\mathbf{s} = \mathbf{q}K^{\top}{:math}`              | (0.148, 0.121, 0.995, 0.121) |
| 주목 벡터 `\mathbf{a} = \mathrm{softmax}(\mathbf{s}){:math}` | (0.189, 0.184, 0.442, 0.184) |
| 문맥 벡터 `\mathbf{c} = \mathbf{a}V{:math}`                  | (2.805, 1.631, 4.005)        |

```math
\mathbf{c} = 0.1895 \times (1\ 2\ 5) + 0.1843 \times (1\ 1\ 5) + 0.4419 \times (3\ 2\ 4) + 0.1843 \times (6\ 1\ 2) = (2.8053\ \ 1.6314\ \ 4.0052)
```

<details>
<summary>유사도와 소프트맥스 계산 과정</summary>

```math
\begin{aligned}
s_1 &= 0.990 \times 0.050 + 0.099 \times 0.000 + 0.099 \times 0.998 = 0.1483 \\
s_2 &= 0.990 \times 0.020 + 0.099 \times 0.020 + 0.099 \times 0.999 = 0.1207 \\
s_3 &= 0.990 \times 0.976 + 0.099 \times 0.098 + 0.099 \times 0.195 = 0.9952 \\
s_4 &= 0.990 \times 0.020 + 0.099 \times 0.999 + 0.099 \times 0.020 = 0.1207
\end{aligned}
```

`e^{0.1483} = 1.1599{:math}`, `e^{0.1207} = 1.1283{:math}`, `e^{0.9952} = 2.7053{:math}`이고 합은 `1.1599 + 1.1283 + 2.7053 + 1.1283 = 6.1218{:math}`이다.

```math
\mathbf{a} = \left(\frac{1.1599}{6.1218},\ \frac{1.1283}{6.1218},\ \frac{2.7053}{6.1218},\ \frac{1.1283}{6.1218}\right) = (0.1895,\ 0.1843,\ 0.4419,\ 0.1843)
```

</details>

### 바다나우 어텐션

seq2seq는 모든 정보를 인코더의 마지막 은닉 상태 `\mathbf{h}^5{:math}`에 쥐어짜 넣어야 하는 부담이 있다. 바다나우(Bahdanau, Cho, Bengio, 2014)는 디코더가 인코더의 모든 상태 `\mathbf{h}^1, \mathbf{h}^2, \ldots{:math}`에 접근할 수 있게 허용했다.

![저게 저절로 붉어질 리 없다를 읽은 인코더와, 자기 회귀로 That can′t turn red by itself를 생성하는 디코더의 추론 단계](./images/dl-word-embedding-attention-08.jpg '디코더 g6가 itself를 생성하려면 인코더의 h2(저절로)에 주목해야 한다 (강의 자료)')

"저게 저절로 붉어질 리 없다"를 "That can't turn red by itself"로 번역할 때, 디코더 `\mathbf{g}^6{:math}`가 itself를 제대로 생성하려면 인코더의 `\mathbf{h}^2{:math}`('저절로')에 주목해야 한다. 주목 벡터가 두 번째 원소에서 가장 큰 값을 가지는 것이 바람직하다.

seq2seq + 어텐션 모델에서 query, key, value는 다음과 같다.

| 이름       | 해당하는 벡터                           |
| ---------- | --------------------------------------- |
| Q (query)  | `t{:math}` 시점의 디코더 셀의 은닉 상태 |
| K (keys)   | 모든 시점의 인코더 셀의 은닉 상태들     |
| V (values) | 모든 시점의 인코더 셀의 은닉 상태들     |

![g5를 query로, h1~h5를 key와 value로 사용해 주목 가중치 0.151, 0.340, 0.162, 0.169, 0.178과 문맥 벡터 c를 계산하고 g6에 전달하는 그림](./images/dl-word-embedding-attention-09.jpg 'g5가 query이고 h1~h5가 key이자 value다 (강의 자료)')

`\mathbf{g}^5 = (0.2, 0.9, 0.0){:math}`, `\mathbf{h}^1 = (0.1, 0.0, 0.8){:math}`, `\mathbf{h}^2 = (0.1, 0.9, 0.0){:math}`, `\mathbf{h}^3 = (0.0, 0.1, 0.8){:math}`, `\mathbf{h}^4 = (0.2, 0.1, 0.6){:math}`, `\mathbf{h}^5 = (0.9, 0.0, 0.1){:math}`일 때 다시 계산한 값이다.

| 단계                               | 값                                  |
| ---------------------------------- | ----------------------------------- |
| 유사도 `\mathbf{q}K^{\top}{:math}` | (0.02, 0.83, 0.09, 0.13, 0.18)      |
| 주목 벡터                          | (0.151, 0.340, 0.162, 0.169, 0.178) |
| 문맥 벡터 `\mathbf{c}{:math}`      | (0.243, 0.339, 0.370)               |

주목 벡터는 기대대로 두 번째(`\mathbf{h}^2{:math}`, '저절로')에서 가장 크다. 이 문맥 벡터가 다음 시점의 디코더 `\mathbf{g}^6{:math}`에 입력된다.

일반화하면 디코더 `i{:math}`번째 시점에서 query는 `\mathbf{g}^{i-1}{:math}`, key와 value는 `\mathbf{h}^1, \ldots, \mathbf{h}^T{:math}`이고, 주목 가중치 `a_1^i, \ldots, a_T^i{:math}`로 문맥 벡터 `\mathbf{c}^i{:math}`를 만든다. 기본 seq2seq 수식(11.4)에 `\mathbf{c}^i{:math}` 항 하나가 추가된다(11.6).

```math
\text{기본 seq2seq: } \left\{\begin{aligned} \mathbf{g}^i &= \tau_1\left(\mathbf{U}^3\mathbf{g}^{i-1} + \mathbf{U}^1\mathbf{y}^{i-1}\right) \\ \mathbf{o}^i &= \tau_2\left(\mathbf{U}^2\mathbf{g}^i\right) \end{aligned}\right. \qquad (11.4)
```

```math
\text{seq2seq + 어텐션: } \left\{\begin{aligned} \mathbf{g}^i &= \tau_1\left(\mathbf{U}^3\mathbf{g}^{i-1} + \mathbf{U}^1\mathbf{y}^{i-1} + \mathbf{U}^4\mathbf{c}^i\right) \\ \mathbf{o}^i &= \tau_2\left(\mathbf{U}^2\mathbf{g}^i\right) \end{aligned}\right. \qquad (11.6)
```

![인코더 h1~hT와 주목 가중치 a^i, 디코더 g^{i-1}을 query로 문맥 벡터 c^i를 만드는 일반적인 구조와 두 수식](./images/dl-word-embedding-attention-10.jpg '디코더의 매 시점 g^{i-1}이 query가 되어 c^i를 새로 계산한다 (강의 자료)')

`\tau_1, \tau_2{:math}`는 활성 함수, `\mathbf{y}^{i-1}{:math}`은 이전 시점의 출력 단어다.

> [!TIP]
> 원 논문의 바다나우 어텐션은 query와 key의 유사도를 내적이 아니라 작은 신경망(`\mathbf{v}^{\top}\tanh(W_1\mathbf{g}^{i-1} + W_2\mathbf{h}^j){:math}`)으로 계산하는 가산(additive) 방식이다. 강의 예제처럼 내적으로 유사도를 구하는 방식은 루옹(Luong) 어텐션에서 쓰였고, 트랜스포머의 스케일드 내적 어텐션으로 이어진다.

## 실습: RNN을 이용한 인코더-디코더

영어 문장을 프랑스어로 번역하는 seq2seq를 LSTM으로 만든다. 데이터는 manythings.org의 영어-프랑스어 병렬 말뭉치 `fra-eng.zip`이다.

```python
import os
import re
import shutil
import zipfile

import numpy as np
import pandas as pd
import tensorflow as tf
import unicodedata
import urllib3
from tensorflow.keras.layers import Embedding, GRU, Dense
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.preprocessing.text import Tokenizer

import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def download_zip(url, output_path):
    response = requests.get(url, headers=headers, stream=True)
    if response.status_code == 200:
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"ZIP file downloaded to {output_path}")
    else:
        print(f"Failed to download. HTTP Response Code: {response.status_code}")

url = "http://www.manythings.org/anki/fra-eng.zip"
output_path = "fra-eng.zip"
download_zip(url, output_path)

path = os.getcwd()
zipfilename = os.path.join(path, output_path)

with zipfile.ZipFile(zipfilename, 'r') as zip_ref:
    zip_ref.extractall(path)
```

사이트가 기본 User-Agent의 요청을 거부하므로 브라우저의 User-Agent를 헤더에 넣어 내려받는다.

### 전처리

```python
num_samples = 33000

def to_ascii(s):
    # 프랑스어 악센트(accent) 삭제
    # 예시 : 'déjà diné' -> deja dine
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')

def preprocess_sentence(sent):
    # 악센트 제거 함수 호출
    sent = to_ascii(sent.lower())

    # 단어와 구두점 사이에 공백 추가.
    # ex) "I am a student." => "I am a student ."
    sent = re.sub(r"([?.!,¿])", r" \1", sent)

    # (a-z, A-Z, ".", "?", "!", ",") 이들을 제외하고는 전부 공백으로 변환
    sent = re.sub(r"[^a-zA-Z!.?]+", r" ", sent)

    # 다수 개의 공백을 하나의 공백으로 치환
    sent = re.sub(r"\s+", " ", sent)
    return sent

def load_preprocessed_data():
    encoder_input, decoder_input, decoder_target = [], [], []

    with open("fra.txt", "r") as lines:
        for i, line in enumerate(lines):
            # source 데이터와 target 데이터 분리
            src_line, tar_line, _ = line.strip().split('\t')

            # source 데이터 전처리
            src_line = [w for w in preprocess_sentence(src_line).split()]

            # target 데이터 전처리
            tar_line = preprocess_sentence(tar_line)
            tar_line_in = [w for w in ("<sos> " + tar_line).split()]
            tar_line_out = [w for w in (tar_line + " <eos>").split()]

            encoder_input.append(src_line)
            decoder_input.append(tar_line_in)
            decoder_target.append(tar_line_out)

            if i == num_samples - 1:
                break

    return encoder_input, decoder_input, decoder_target
```

`unicodedata.normalize('NFD', s)`는 é를 e와 결합용 악센트 기호로 분해하고, 범주가 `Mn`(결합 문자)인 기호를 버리면 악센트가 사라진다. `fra.txt`의 한 줄은 영어, 프랑스어, 출처가 탭으로 구분되어 있다.

```text
인코더의 입력 : [['go', '.'], ['go', '.'], ['go', '.'], ['go', '.'], ['hi', '.']]
디코더의 입력 : [['<sos>', 'va', '!'], ['<sos>', 'marche', '.'], ['<sos>', 'en', 'route', '!'], ['<sos>', 'bouge', '!'], ['<sos>', 'salut', '!']]
디코더의 레이블 : [['va', '!', '<eos>'], ['marche', '.', '<eos>'], ['en', 'route', '!', '<eos>'], ['bouge', '!', '<eos>'], ['salut', '!', '<eos>']]
```

==디코더의 입력은 앞에 `<sos>`를 붙이고 레이블은 뒤에 `<eos>`를 붙이므로, 레이블은 입력을 한 칸 앞당긴 시퀀스다.== 시점 `t{:math}`의 입력이 정답 단어 `t-1{:math}`번째이므로 이 데이터 구성 자체가 교사 강요다.

### 정수 인코딩과 패딩

```python
tokenizer_en = Tokenizer(filters="", lower=False)
tokenizer_en.fit_on_texts(sents_en_in)
encoder_input = tokenizer_en.texts_to_sequences(sents_en_in)
encoder_input = pad_sequences(encoder_input, padding="post")

tokenizer_fra = Tokenizer(filters="", lower=False)
tokenizer_fra.fit_on_texts(sents_fra_in)
tokenizer_fra.fit_on_texts(sents_fra_out)

decoder_input = tokenizer_fra.texts_to_sequences(sents_fra_in)
decoder_input = pad_sequences(decoder_input, padding="post")

decoder_target = tokenizer_fra.texts_to_sequences(sents_fra_out)
decoder_target = pad_sequences(decoder_target, padding="post")

src_vocab_size = len(tokenizer_en.word_index) + 1
tar_vocab_size = len(tokenizer_fra.word_index) + 1
```

```text
인코더의 입력의 크기(shape) : (33000, 7)
디코더의 입력의 크기(shape) : (33000, 16)
디코더의 레이블의 크기(shape) : (33000, 16)
영어 단어 집합의 크기 : 4481, 프랑스어 단어 집합의 크기 : 7873
```

`filters=""`로 구두점을 지우지 않고 `<sos>`, `<eos>`도 단어로 등록한다. `padding="post"`는 뒤쪽에 0을 채운다. 영어 문장은 최대 7토큰, 프랑스어는 `<sos>` 또는 `<eos>`를 포함해 최대 16토큰이다. 단어 집합 크기에 1을 더하는 이유는 0번이 패딩용으로 예약되어 있기 때문이다.

```python
src_to_index = tokenizer_en.word_index
index_to_src = tokenizer_en.index_word
tar_to_index = tokenizer_fra.word_index
index_to_tar = tokenizer_fra.index_word

indices = np.arange(encoder_input.shape[0])
np.random.shuffle(indices)

encoder_input = encoder_input[indices]
decoder_input = decoder_input[indices]
decoder_target = decoder_target[indices]

n_of_val = int(33000 * 0.1)
encoder_input_train = encoder_input[:-n_of_val]
decoder_input_train = decoder_input[:-n_of_val]
decoder_target_train = decoder_target[:-n_of_val]

encoder_input_test = encoder_input[-n_of_val:]
decoder_input_test = decoder_input[-n_of_val:]
decoder_target_test = decoder_target[-n_of_val:]
```

```text
encoder input 샘플 출력:  [  2  41 175 629   1   0   0]
decoder input 샘플 출력:  [  2  13  50  22 661 953   1   0   0   0   0   0   0   0   0   0]
decoder target 샘플 출력: [ 13  50  22 661 953   1   3   0   0   0   0   0   0   0   0   0]
훈련 source 데이터의 크기 : (29700, 7)
테스트 source 데이터의 크기 : (3300, 7)
```

세 배열을 같은 `indices`로 섞어 짝을 유지한다. 검증 데이터는 `int(33000 \times 0.1) = 3300{:math}`개, 훈련 데이터는 29700개다. 프랑스어 번호를 보면 1번이 마침표, 2번이 `<sos>`, 3번이 `<eos>`다. `Tokenizer`는 빈도순으로 번호를 매기는데, 마침표는 입력과 레이블 양쪽에서 집계되어 가장 많고, `<sos>`와 `<eos>`는 각각 33000번 등장하기 때문이다. 디코더 입력은 2(`<sos>`)로 시작하고, 레이블은 같은 단어를 한 칸 앞당겨 1(`.`) 다음에 3(`<eos>`)으로 끝난다.

### 훈련용 모델

```python
from tensorflow.keras.layers import Input, LSTM, Embedding, Dense, Masking
from tensorflow.keras.models import Model

embedding_dim = 64
hidden_units = 64

# 인코더
encoder_inputs = Input(shape=(None,))
enc_emb = Embedding(src_vocab_size, embedding_dim)(encoder_inputs)  # 임베딩 층
enc_masking = Masking(mask_value=0.0)(enc_emb)  # 패딩 0은 연산에서 제외
encoder_lstm = LSTM(hidden_units, return_state=True)  # 상태값 리턴을 위해 return_state는 True
encoder_outputs, state_h, state_c = encoder_lstm(enc_masking)  # 은닉 상태와 셀 상태를 리턴
encoder_states = [state_h, state_c]  # 인코더의 은닉 상태와 셀 상태를 저장

# 디코더
decoder_inputs = Input(shape=(None,))
dec_emb_layer = Embedding(tar_vocab_size, hidden_units)  # 임베딩 층
dec_emb = dec_emb_layer(decoder_inputs)
dec_masking = Masking(mask_value=0.0)(dec_emb)  # 패딩 0은 연산에서 제외

# 상태값 리턴을 위해 return_state는 True,
# 모든 시점에 대해서 단어를 예측하기 위해 return_sequences는 True
decoder_lstm = LSTM(hidden_units, return_sequences=True, return_state=True)

# 인코더의 은닉 상태를 초기 은닉 상태(initial_state)로 사용
decoder_outputs, _, _ = decoder_lstm(dec_masking, initial_state=encoder_states)

# 모든 시점의 결과에 대해서 소프트맥스 함수를 사용한 출력층을 통해 단어 예측
decoder_dense = Dense(tar_vocab_size, activation='softmax')
decoder_outputs = decoder_dense(decoder_outputs)

# 모델의 입력과 출력을 정의.
model = Model([encoder_inputs, decoder_inputs], decoder_outputs)

model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['acc'])

model.fit(x=[encoder_input_train, decoder_input_train], y=decoder_target_train,
          validation_data=([encoder_input_test, decoder_input_test], decoder_target_test),
          batch_size=128, epochs=50)
```

| 부분                                  | 의미                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Input(shape=(None,))`                | 길이를 정하지 않은 정수 시퀀스                                                              |
| `Masking(mask_value=0.0)`             | 임베딩 결과가 0인 패딩 위치를 LSTM 연산에서 건너뛴다                                        |
| 인코더 `return_state=True`            | 출력과 함께 마지막 은닉 상태 `state_h`, 셀 상태 `state_c`를 돌려준다. 이 둘이 컨텍스트 벡터 |
| 디코더 `initial_state=encoder_states` | 인코더의 마지막 상태로 디코더를 시작한다                                                    |
| 디코더 `return_sequences=True`        | 모든 시점의 은닉 상태를 출력해 시점마다 단어를 예측한다                                     |
| `Dense(tar_vocab_size, softmax)`      | 매 시점 프랑스어 7873개 단어의 확률                                                         |

`dec_emb_layer`의 출력 차원은 `hidden_units`(64)로, `embedding_dim`과 값이 같아 결과는 동일하다. 첫 import 줄의 `GRU`는 이 실습에서 사용하지 않는다.

### 추론용 모델

==훈련 과정(교사 강요)과 테스트 과정의 동작 방식이 다르다.== 추론 시에는 정답을 모르므로 다음 단계를 따른다.

1. 번역할 입력 문장을 인코더에 넣어 인코더의 마지막 시점의 은닉 상태와 셀 상태를 얻는다.
2. 인코더의 은닉 상태와 셀 상태, 그리고 토큰 `<sos>`를 디코더로 보낸다.
3. 디코더가 토큰 `<eos>`가 나올 때까지 다음 단어를 예측하고, 그 단어를 다음 시점의 입력으로 넣는 동작을 반복한다.

```python
# 인코더
encoder_model = Model(encoder_inputs, encoder_states)

# 디코더 설계 시작
# 이전 시점의 상태를 보관할 텐서
decoder_state_input_h = Input(shape=(hidden_units,))
decoder_state_input_c = Input(shape=(hidden_units,))
decoder_states_inputs = [decoder_state_input_h, decoder_state_input_c]

# 훈련 때 사용했던 임베딩 층을 재사용
dec_emb2 = dec_emb_layer(decoder_inputs)

# 다음 단어 예측을 위해 이전 시점의 상태를 현 시점의 초기 상태로 사용
decoder_outputs2, state_h2, state_c2 = decoder_lstm(dec_emb2, initial_state=decoder_states_inputs)
decoder_states2 = [state_h2, state_c2]

# 모든 시점에 대해서 단어 예측
decoder_outputs2 = decoder_dense(decoder_outputs2)

# 수정된 디코더
decoder_model = Model(
    [decoder_inputs] + decoder_states_inputs,
    [decoder_outputs2] + decoder_states2)
```

추론용 모델은 훈련한 층(`dec_emb_layer`, `decoder_lstm`, `decoder_dense`)을 그대로 재사용하므로 가중치를 공유한다. 디코더 모델은 단어 하나와 이전 상태를 받아 다음 단어의 확률과 새 상태를 돌려준다.

```python
def decode_sequence(input_seq):
    # 입력으로부터 인코더의 마지막 시점의 상태(은닉 상태, 셀 상태)를 얻음
    states_value = encoder_model.predict(input_seq)

    # <SOS>에 해당하는 정수 생성
    target_seq = np.zeros((1, 1))
    target_seq[0, 0] = tar_to_index['<sos>']

    stop_condition = False
    decoded_sentence = ''

    # stop_condition이 True가 될 때까지 루프 반복
    # 구현의 간소화를 위해서 이 함수는 배치 크기를 1로 가정합니다.
    while not stop_condition:
        # 이점 시점의 상태 states_value를 현 시점의 초기 상태로 사용
        output_tokens, h, c = decoder_model.predict([target_seq] + states_value)

        # 예측 결과를 단어로 변환
        sampled_token_index = np.argmax(output_tokens[0, -1, :])
        sampled_char = index_to_tar[sampled_token_index]

        # 현재 시점의 예측 단어를 예측 문장에 추가
        decoded_sentence += ' ' + sampled_char

        # <eos>에 도달하거나 정해진 길이를 넘으면 중단.
        if (sampled_char == '<eos>' or
                len(decoded_sentence) > 50):
            stop_condition = True

        # 현재 시점의 예측 결과를 다음 시점의 입력으로 사용하기 위해 저장
        target_seq = np.zeros((1, 1))
        target_seq[0, 0] = sampled_token_index

        # 현재 시점의 상태를 다음 시점의 상태로 사용하기 위해 저장
        states_value = [h, c]

    return decoded_sentence
```

매 시점 확률이 가장 높은 단어 하나를 고르는 탐욕적(greedy) 디코딩이다. 출력 문자열이 50자를 넘으면 `<eos>`가 나오지 않아도 멈춘다.

### 번역 결과

```python
# 원문의 정수 시퀀스를 텍스트 시퀀스로 변환
def seq_to_src(input_seq):
    sentence = ''
    for encoded_word in input_seq:
        if (encoded_word != 0):
            sentence = sentence + index_to_src[encoded_word] + ' '
    return sentence

# 번역문의 정수 시퀀스를 텍스트 시퀀스로 변환
def seq_to_tar(input_seq):
    sentence = ''
    for encoded_word in input_seq:
        if (encoded_word != 0 and encoded_word != tar_to_index['<sos>'] and encoded_word != tar_to_index['<eos>']):
            sentence = sentence + index_to_tar[encoded_word] + ' '
    return sentence

for seq_index in [3, 50, 100, 300, 1001]:
    input_seq = encoder_input_train[seq_index: seq_index + 1]
    decoded_sentence = decode_sequence(input_seq)

    print("입력문장 :", seq_to_src(encoder_input_train[seq_index]))
    print("정답문장 :", seq_to_tar(decoder_input_train[seq_index]))
    print("번역문장 :", decoded_sentence[1:-5])
    print("-" * 50)
```

`decoded_sentence[1:-5]`는 앞의 공백과 끝의 `<eos>` 다섯 글자를 잘라 낸다.

![입력 문장, 정답 문장, 번역 문장 다섯 쌍](./images/dl-word-embedding-attention-11.jpg '짧은 문장은 정확히 번역하지만 형용사나 동사가 다른 단어로 바뀌는 경우가 많다 (강의 자료)')

| 입력                | 정답                                  | 번역                     |
| ------------------- | ------------------------------------- | ------------------------ |
| we are busy men .   | nous sommes des hommes occupes .      | nous sommes tres vieux . |
| it was very ugly .  | ce n etait vraiment pas beau a voir . | c etait tres fort .      |
| tom looks shocked . | tom a l air choque .                  | tom a l air bien .       |
| cross the street .  | traversez la rue .                    | la ?                     |
| you nearly died .   | tu es presque mort .                  | tu es presque mort .     |

문장 구조(nous sommes, tom a l air)는 맞히지만 핵심 형용사(occupes → vieux, choque → bien)를 다른 단어로 바꾸는 경우가 많다. 다섯 문장 가운데 완전히 맞힌 것은 마지막 하나다. 64차원 LSTM 하나의 마지막 상태에 문장 전체를 압축하는 seq2seq의 한계가 그대로 드러나고, 이 한계를 줄이는 방법이 앞에서 정리한 어텐션이다.

## 정리

| 주제        | 핵심                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| 단어 임베딩 | 원핫 코드 대신 저차원 밀집 벡터. word2vec(CBOW, Skip-gram), GloVe(동시 등장 행렬)                    |
| seq2seq     | 인코더의 마지막 상태(컨텍스트 벡터)로 디코더를 시작. 학습은 교사 강요                                |
| 어텐션      | `\mathbf{c} = \mathrm{softmax}(\mathbf{q}K^{\top})V{:math}`. 디코더 시점마다 인코더 전체를 다시 조회 |

==어텐션은 RNN의 마지막 상태에 의존하던 seq2seq에 인코더 전체를 조회하는 경로를 추가했고, 다음 단계는 RNN 자체를 없애고 어텐션만으로 시퀀스를 처리하는 트랜스포머다.==
