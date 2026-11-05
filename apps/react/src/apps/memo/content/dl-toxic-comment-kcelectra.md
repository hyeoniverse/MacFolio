---
title: KcELECTRA 미세 조정으로 만든 악성 댓글 분류 모델
date: 2023-12-18
category: CS/딥러닝
series: 딥러닝 및 응용
seriesOrder: 9
summary: 기말 프로젝트로 공개 악성 댓글 데이터셋 두 개를 합쳐 전처리하고, 인터넷 댓글로 사전 학습한 KcELECTRA를 Hugging Face Trainer로 미세 조정했다. 테스트 정확도 92.3%의 결과와 혼동 행렬, 과적합과 데이터 처리의 한계를 분석한다.
---

딥러닝 및 응용 연재의 아홉 번째 글로, 기말 프로젝트인 악성 댓글 분류 모델을 다룬다. [트랜스포머의 셀프 어텐션과 멀티 헤드 어텐션](/memo/dl-transformer)에서 정리한 트랜스포머 인코더를 쌓은 사전 학습 언어 모델 KcELECTRA를 한국어 댓글 이진 분류에 미세 조정(fine-tuning)했다. 작업은 Google Colab에서 PyTorch와 Hugging Face Transformers 4.35.2로 진행했다.

## 배경과 목표

국가인권위원회가 2021년 실시한 「온라인 혐오표현 인식조사」에서 응답자 10명 중 8명이 온라인 혐오 표현이 심각하다고 답했다. 이 프로젝트는 댓글을 악성 댓글과 정상 댓글로 자동 분류해 혐오 표현을 걸러 내는 모델을 만들고 결과를 분석하는 것을 목표로 한다.

![프로젝트 개요 슬라이드: 목표는 악성 댓글 분류 모델 제작, 장애물은 구어체와 신조어, 비속어, 오탈자로 이루어진 정제되지 않은 글, 모델은 KcELECTRA](./images/dl-toxic-comment-kcelectra-01.jpg '목표, 장애물, 모델 선택 (발표 자료)')

인터넷 댓글은 구어체이고 신조어, 비속어, 오탈자, 초성 표기, 욕설 사이에 특수문자를 끼운 우회 표현이 많다. 위키백과나 뉴스 기사처럼 정제된 글로 사전 학습한 모델은 이런 표현의 토큰을 제대로 분해하지 못하므로, 인터넷 댓글로 사전 학습한 KcELECTRA를 선택했다.

![프로젝트 구성 슬라이드: GitHub 데이터셋, KcELECTRA 모델, Hugging Face 토크나이저](./images/dl-toxic-comment-kcelectra-02.jpg '데이터셋, 모델, 토크나이저의 출처 (발표 자료)')

## 데이터셋

GitHub에 공개된 데이터셋 두 개를 내려받아 합쳤다. 두 저장소 모두 MIT 라이선스다.

| 구분        | 데이터셋 1                                     | 데이터셋 2                               |
| ----------- | ---------------------------------------------- | ---------------------------------------- |
| 저장소      | ZIZUN/korean-malicious-comments-dataset        | 2runo/Curse-detection-data               |
| 라이선스    | MIT                                            | MIT                                      |
| 문장 수     | 10,000                                         | 5,825 (README 기준)                      |
| 출처        | Korean HateSpeech Dataset 문장을 직접 재라벨링 | 일간베스트, 오늘의 유머 등 커뮤니티 댓글 |
| 파일 구분자 | 탭 `\t`                                        | 수직선 `\|`                              |
| 라벨        | 0 = 악성, 1 = 정상                             | 1 = 악성, 0 = 정상                       |

> [!NOTE]
> 데이터셋 1의 원천인 kocohub/korean-hate-speech(연예 뉴스 댓글)는 CC BY-SA 4.0 라이선스다. 데이터셋 1은 그 문장에 악성 여부를 새로 라벨링했고, 원 데이터의 offensive 라벨은 공격적이지만 악성 댓글은 아닌 경우가 있어 사용하지 않았다.

분류 기준은 다음과 같다.

| 판정      | 기준                                                                     |
| --------- | ------------------------------------------------------------------------ |
| 악성 댓글 | 욕설, 강한 혐오 표현, 비난이 들어간 문장                                 |
| 정상 댓글 | '존맛', '개이득'처럼 비속어를 포함하지만 악의 없이 강조 의미로만 쓴 문장 |
| 정상 댓글 | 상황에 따라 욕설로도, 아닌 것으로도 해석되는 문장 (최대한 비욕설로 분류) |

![데이터셋 슬라이드: 두 데이터셋의 출처와 문장 수, 분류 기준](./images/dl-toxic-comment-kcelectra-03.jpg '데이터 출처와 분류 기준 (발표 자료)')

## 전처리

### 환경 설정과 데이터 불러오기

```python
!pip install transformers
!pip install accelerate -U

!git clone https://github.com/ZIZUN/korean-malicious-comments-dataset.git
!git clone https://github.com/2runo/Curse-detection-data.git

import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer
from sklearn.metrics import precision_recall_fscore_support, accuracy_score

device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')

df_1 = pd.read_csv("/content/korean-malicious-comments-dataset/Dataset.csv", sep="\t")  # 악플 0, 정상 1
df_2 = pd.read_csv("/content/Curse-detection-data/dataset.txt", sep="|")                 # 악플 1, 정상 0
```

데이터셋 2를 처음 불러온 시각에 `ParserError: Expected 2 fields in line 456, saw 3`이 발생했다. 456번째 줄의 댓글 본문 안에 구분자 `|`가 들어 있어 열이 3개로 쪼개진 것이 원인이었고, 내려받은 원본 파일에서 해당 문자를 직접 수정해 해결했다.

![데이터셋 2를 불러오는 코드와 ParserError 화면, 본문에 구분자가 들어간 456번째 줄을 수정한 모습](./images/dl-toxic-comment-kcelectra-04.jpg '본문 속 구분자로 생긴 파싱 오류와 수정 (발표 자료)')

### 결측 라벨 복구

`df_1.info(){:python}`를 조회하면 content는 10,000개인데 라벨 열(원본 열 이름 `lable`)은 9,975개만 값이 있어 25개가 결측이었다. 결측 행의 본문을 조회하니 `토니스타크 평소 "아이엠그루트"라는 유행어를 부러워했다는게 학계의 정설\t1`처럼 구분자 탭과 라벨까지 본문 문자열에 포함되어 있었다. 결측 행은 대부분 본문에 큰따옴표가 들어간 문장이었고, pandas가 큰따옴표를 인용 부호로 해석하면서 탭을 구분자로 인식하지 못했다.

```python
null_idx = df_1[df_1.lable.isnull()].index

# 본문의 마지막 글자가 라벨, 끝의 "\t" + 라벨 두 글자를 뺀 나머지가 본문
df_1.loc[null_idx, "lable"] = df_1.loc[null_idx, "content"].apply(lambda x: x[-1])
df_1.loc[null_idx, "content"] = df_1.loc[null_idx, "content"].apply(lambda x: x[:-2])

df_1 = df_1.astype({"lable": "int"})  # float → int (결측값 때문에 float였다)
```

![결측 라벨을 조회한 출력과 복구 코드](./images/dl-toxic-comment-kcelectra-05.jpg '구분자 앞의 특수문자(큰따옴표) 때문에 생긴 결측 라벨 25개를 복구했다 (발표 자료)')

> [!TIP]
> 이 오류는 `pd.read_csv(..., sep="\t", quoting=csv.QUOTE_NONE){:python}`로 인용 부호 해석을 끄면 불러오는 단계에서 막을 수 있다.

### 라벨 통일과 병합

두 데이터셋의 열 이름을 `content`, `label`로 맞추고, 데이터셋 2의 라벨을 뒤집어 0 = 악성, 1 = 정상으로 통일한 뒤 하나로 합쳤다.

```python
df_1.columns = ['content', 'label']
df_2.columns = ['content', 'label']
df_2['label'] = df_2['label'].replace({0: 1, 1: 0})

df = pd.concat([df_1, df_2], axis=0, ignore_index=True)
```

### 학습·테스트 분할과 중복 삭제

전체를 8:2로 나눈 뒤 각 세트 안에서 본문이 같은 문장을 삭제했다.

```python
train_data = df.sample(frac=0.8, random_state=42)
test_data = df.drop(train_data.index)

train_data.drop_duplicates(subset=['content'], inplace=True)
test_data.drop_duplicates(subset=['content'], inplace=True)
```

| 단계         | 학습   | 테스트 | 합계   |
| ------------ | ------ | ------ | ------ |
| 중복 삭제 전 | 12,659 | 3,165  | 15,824 |
| 중복 삭제 후 | 11,728 | 3,109  | 14,837 |
| 삭제된 문장  | 931    | 56     | 987    |

![데이터셋 1 10,000문장과 데이터셋 2 5,824문장을 병합해 15,824문장을 만들고 8:2로 나눈 뒤 중복을 삭제해 학습 11,728, 테스트 3,109문장이 되는 흐름도](./images/dl-toxic-comment-kcelectra-12.svg '데이터셋 구성 단계별 문장 수')

> [!WARNING] 합계는 15,825가 아니라 15,824
> 발표에서는 두 데이터셋을 합쳐 15,825문장이라고 했지만 노트북 출력의 합계는 12,659 + 3,165 = 15,824다. 데이터셋 2 파일에는 열 이름 줄이 없는데 `read_csv`를 `header=None` 없이 호출해 첫 문장 `좌배 까는건 ㅇㅂ|1`이 열 이름으로 쓰였고, 그 결과 데이터셋 2는 5,824행만 남았다.

![분할과 중복 삭제 코드, 중복 삭제 전후 학습·테스트 데이터 수 출력](./images/dl-toxic-comment-kcelectra-06.jpg '분할과 중복 삭제 결과 (발표 자료)')

## 토큰화

Hugging Face Hub에 등록된 모델은 토크나이저도 함께 올라가 있어 `AutoTokenizer.from_pretrained(){:python}`만으로 같은 어휘를 불러온다. KcELECTRA는 WordPiece 토크나이저를 사용한다.

```python
MODEL_NAME = "beomi/KcELECTRA-base-v2022"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

tokenized_train_sentences = tokenizer(
    list(train_data["content"]),
    return_tensors="pt",     # PyTorch 텐서로 반환
    max_length=128,
    padding=True,            # 가장 긴 문장 길이로 0 패딩
    truncation=True,         # 128 토큰 초과분 삭제
    add_special_tokens=True, # [CLS], [SEP] 추가
)
```

학습 세트 첫 문장의 토큰화 결과는 다음과 같다. `##`는 앞 토큰에 붙는 하위 단어를 뜻하고, 문장 길이 14 이후는 `[PAD]`(id 0)로 채워 128 토큰을 맞춘다. `attention_mask`는 실제 토큰 위치에 1, 패딩 위치에 0을 넣어 어텐션 계산에서 패딩을 제외한다.

| 항목           | 값                                                                                 |
| -------------- | ---------------------------------------------------------------------------------- |
| 원문           | 김포는 뭐 김 네장씩 싸먹는 새끼들이냐?                                             |
| tokens         | `[CLS]` 김포 ##는 뭐 김 네 ##장 ##씩 싸 ##먹는 새끼들이 ##냐 ? `[SEP]` `[PAD]` …   |
| input_ids      | 2, 13841, 4027, 1867, 1048, 1242, 4019, 4787, 2360, 9017, 17076, 4110, 33, 3, 0, … |
| attention_mask | 1이 14개, 이후 0이 114개                                                           |

![토큰화 코드와 첫 문장의 토큰, id, 어텐션 마스크 출력](./images/dl-toxic-comment-kcelectra-07.jpg '토크나이저 출력 (발표 자료)')

토큰화한 결과와 라벨을 `torch.utils.data.Dataset`으로 감싸 Trainer가 배치를 만들 수 있게 한다.

```python
class CurseDataset(torch.utils.data.Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels

    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[idx])
        return item

    def __len__(self):
        return len(self.labels)

train_dataset = CurseDataset(tokenized_train_sentences, train_data["label"].values)
test_dataset = CurseDataset(tokenized_test_sentences, test_data["label"].values)
```

`val[idx]`가 이미 텐서이므로 `torch.tensor()`로 다시 감싸면 복사 경고(`UserWarning: To copy construct from a tensor`)가 배치마다 출력된다. `val[idx].clone().detach(){:python}`나 `val[idx]`를 그대로 반환하면 경고가 사라진다.

## 모델

### ELECTRA

ELECTRA(Efficiently Learning an Encoder that Classifies Token Replacements Accurately)는 Clark 등이 ICLR 2020에 발표한 사전 학습 방법이다. 구조는 BERT와 같은 트랜스포머 인코더이고, 사전 학습 과제가 다르다.

BERT의 마스크 언어 모델(MLM)은 입력의 15%를 `[MASK]`로 바꾸고 그 위치의 원래 단어만 맞히므로, 한 문장에서 손실을 받는 토큰이 15%뿐이다. ==ELECTRA는 작은 MLM 생성자가 `[MASK]` 자리를 그럴듯한 단어로 채우면, 판별자가 모든 토큰에 대해 원본인지 대체된 것인지 판정하는 대체 토큰 탐지(replaced token detection)로 학습한다.== 모든 위치에서 학습 신호를 받으므로 같은 연산량으로 BERT보다 높은 성능을 낸다.

![원문 the chef cooked the meal에서 두 단어를 마스킹하고 생성자가 cooked를 ate로 바꾼 뒤 판별자가 각 토큰을 원본 또는 대체로 판정하는 도식](./images/dl-toxic-comment-kcelectra-13.svg '대체 토큰 탐지. 원 논문의 예시 문장을 사용했다')

생성자 G와 판별자 D를 함께 학습하며, 전체 손실은 생성자의 MLM 손실과 판별자의 이진 분류 손실의 가중합이다.

```math
\min_{\theta_G, \theta_D} \sum_{x \in \mathcal{X}} \mathcal{L}_{\text{MLM}}(x, \theta_G) + \lambda\, \mathcal{L}_{\text{Disc}}(x, \theta_D)
```

```math
\mathcal{L}_{\text{Disc}} = \mathbb{E}\left[ \sum_{t=1}^{n} -\mathbb{1}(x^{\text{corrupt}}_t = x_t) \log D(x^{\text{corrupt}}, t) - \mathbb{1}(x^{\text{corrupt}}_t \ne x_t) \log\big(1 - D(x^{\text{corrupt}}, t)\big) \right]
```

원 논문은 `\lambda = 50{:math}`을 사용했다. 생성자의 표본 추출은 미분할 수 없으므로 판별자 손실이 생성자로 역전파되지 않고, 생성자는 MLM 손실로만 학습한다. 이 점에서 [이미지 생성 글](/memo/dl-image-generation)의 GAN과 구조는 닮았지만 적대적 학습은 아니다. 사전 학습이 끝나면 생성자는 버리고 판별자를 하위 과제에 미세 조정한다.

### KcELECTRA

KcELECTRA(Korean comments ELECTRA)는 이준범(Beomi)이 공개한 한국어 ELECTRA로, MIT 라이선스다. 기존 한국어 모델은 대부분 위키, 뉴스 기사, 책처럼 정제된 글로 학습했지만, KcELECTRA는 네이버 뉴스 기사의 댓글과 대댓글을 수집해 토크나이저와 모델을 처음부터 학습했다. 그래서 구어체, 신조어, 오탈자가 많은 사용자 생성 텍스트(user-generated noisy text)에 강하다.

| 항목             | 내용                                                           |
| ---------------- | -------------------------------------------------------------- |
| 사용 체크포인트  | `beomi/KcELECTRA-base-v2022`                                   |
| 사전 학습 데이터 | 뉴스 댓글·대댓글, v2022 확장 데이터셋 약 45GB(약 3.4억 건)     |
| 어휘 크기        | 54,343 (모델 출력의 `word_embeddings` 크기)                    |
| 구조             | ELECTRA-Base: 인코더 12층, 은닉 768, 어텐션 헤드 12, FFN 3,072 |
| 공개 성능        | NSMC(네이버 영화 리뷰 감성 분류) 정확도 91.97%                 |

![KcELECTRA 설명 슬라이드: 비격식 데이터셋 사용, ELECTRA의 효율적인 사전 학습](./images/dl-toxic-comment-kcelectra-08.jpg 'KcELECTRA를 고른 이유 (발표 자료)')

### 분류 모델 구조

`AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=2){:python}`는 사전 학습된 판별자 본체에 새 분류 헤드를 붙인 `ElectraForSequenceClassification`을 만든다. 불러오는 시각에 `classifier.dense`, `classifier.out_proj`가 새로 초기화되었다는 경고가 나오는데, 분류 헤드는 사전 학습 체크포인트에 없으므로 정상이다.

| 모듈          | 구성                                                      | 매개변수 수 |
| ------------- | --------------------------------------------------------- | ----------- |
| 임베딩        | 단어 54,343×768, 위치 512×768, 토큰 타입 2×768, LayerNorm | 42,131,712  |
| 인코더 층 1개 | Q·K·V·출력 768×768 ×4, FFN 768→3,072→768, LayerNorm 2개   | 7,087,872   |
| 인코더 12층   | 위 층 ×12                                                 | 85,054,464  |
| 분류 헤드     | dense 768×768, out_proj 768×2                             | 592,130     |
| 합계          |                                                           | 127,778,306 |

매개변수 약 1억 2,778만 개를 32비트 실수로 저장하면 약 511MB이고, 실제로 내려받은 `pytorch_model.bin` 크기도 511MB였다. 분류 헤드는 `[CLS]` 위치의 출력 벡터 `h_{\text{CLS}}{:math}`를 받아 두 클래스의 로짓을 계산한다.

```math
\text{logits} = W_2\, \mathrm{GELU}(W_1 h_{\text{CLS}} + b_1) + b_2, \qquad P(y = k \mid x) = \frac{e^{\text{logit}_k}}{\sum_{j=0}^{1} e^{\text{logit}_j}}
```

인코더 층의 셀프 어텐션과 FFN 계산은 [트랜스포머 글](/memo/dl-transformer)의 인코더 블록과 같다. 768차원을 12개 헤드로 나누므로 헤드당 차원은 `d_k = 768 / 12 = 64{:math}`다.

## 학습 설정

Hugging Face `Trainer`는 학습 반복문, 옵티마이저, 학습률 스케줄러, 로그 기록, 체크포인트 저장을 대신 처리한다.

```python
training_args = TrainingArguments(
    output_dir='./',
    num_train_epochs=10,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=64,
    logging_dir='./logs',
    logging_steps=500,
    save_total_limit=2,
)

def compute_metrics(pred):
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='binary')
    acc = accuracy_score(labels, preds)
    return {'accuracty': acc, 'f1': f1, 'precision': precision, 'recall': recall}

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset,
    compute_metrics=compute_metrics,
)
trainer.train()
```

| 설정          | 값                                      | 비고                                |
| ------------- | --------------------------------------- | ----------------------------------- |
| 에폭          | 10                                      | 직접 지정                           |
| 배치 크기     | 학습 8, 평가 64                         | 직접 지정                           |
| 옵티마이저    | AdamW, 학습률 `5 \times 10^{-5}{:math}` | Transformers 기본값                 |
| 학습률 스케줄 | 선형 감소, 워밍업 없음                  | 기본값                              |
| 가중치 감쇠   | 0                                       | 기본값                              |
| 중간 평가     | 없음 (`evaluation_strategy="no"`)       | 기본값, 10에폭 학습 후 한 번만 평가 |
| 손실          | 교차 엔트로피                           | `labels`를 넘기면 모델이 계산       |

학습 세트 11,728문장을 배치 8로 나누면 에폭당 `11{,}728 / 8 = 1{,}466{:math}` 스텝이고, 10에폭이면 14,660 스텝이다. 노트북 출력의 `global_step=14660`과 일치한다.

![모델 불러오기, TrainingArguments, compute_metrics, Trainer 생성 코드](./images/dl-toxic-comment-kcelectra-09.jpg '모델과 학습 설정 코드 (발표 자료)')

> [!NOTE]
> `compute_metrics`의 키 `'accuracty'`는 accuracy의 오타다. 평가 결과에도 `eval_accuracty`로 출력된다.

## 결과

### 학습 손실

| 지표           | 값                            |
| -------------- | ----------------------------- |
| 전체 스텝      | 14,660                        |
| 평균 학습 손실 | 0.1059                        |
| 학습 시간      | 3,492초 (약 58분)             |
| 처리량         | 초당 33.6 표본, 초당 4.2 스텝 |

발표 슬라이드의 손실 로그는 같은 코드를 앞서 실행한 결과(14,630 스텝, 평균 학습 손실 0.0984)다. 500 스텝 간격 손실은 0.4238(500), 0.3512(1,000), 0.3208(1,500), 0.2384(2,000), 0.2454(2,500), 0.2269(3,000), 0.1377(3,500), 0.1408(4,000), 0.1379(4,500), 0.0803(5,000)으로 감소했다. 에폭 경계(약 1,463, 2,926, 4,389 스텝) 직후 구간마다 손실이 계단처럼 떨어지는데, 같은 문장을 다시 본 시각에 손실이 줄어드는 학습 세트 암기의 전형적인 모양이다.

![trainer.train() 진행 막대와 500 스텝 간격 학습 손실 표, TrainOutput 출력](./images/dl-toxic-comment-kcelectra-10.jpg '발표 시각 실행의 학습 손실 로그 (발표 자료)')

### 테스트 세트 평가

```python
trainer.evaluate(eval_dataset=test_dataset)
```

| 지표             | 값     |
| ---------------- | ------ |
| 정확도           | 0.9234 |
| F1 (정상 클래스) | 0.9328 |
| 정밀도           | 0.9266 |
| 재현율           | 0.9392 |
| 평가 손실        | 0.5547 |

==테스트 세트 3,109문장에 대한 정확도는 92.34%다.== `average='binary'`는 라벨 1을 양성으로 보므로 F1, 정밀도, 재현율은 정상 댓글 클래스 기준이다. 세 지표와 정확도에서 혼동 행렬을 역산할 수 있다.

<details>
<summary>혼동 행렬 역산 과정</summary>

재현율 0.9392045454… = 1,653/1,760이므로 실제 정상은 1,760문장, 그중 1,653문장을 정상으로 예측했다(TP). 정밀도 0.9265695067… = 1,653/1,784이므로 정상으로 예측한 문장은 1,784개이고, FP = 1,784 − 1,653 = 131이다. 실제 악성은 3,109 − 1,760 = 1,349문장이고 그중 131개를 놓쳤으므로 TN = 1,218이다. 정확도를 검산하면 (1,653 + 1,218)/3,109 = 2,871/3,109 = 0.92344805로 노트북 출력과 일치한다.

</details>

![실제 악성 1,349문장 중 1,218개를 악성으로, 131개를 정상으로 예측하고, 실제 정상 1,760문장 중 1,653개를 정상으로, 107개를 악성으로 예측한 혼동 행렬](./images/dl-toxic-comment-kcelectra-14.svg '평가 지표에서 역산한 혼동 행렬')

| 클래스 기준 | 정밀도               | 재현율               | F1     |
| ----------- | -------------------- | -------------------- | ------ |
| 정상(1)     | 1,653/1,784 = 0.9266 | 1,653/1,760 = 0.9392 | 0.9328 |
| 악성(0)     | 1,218/1,325 = 0.9192 | 1,218/1,349 = 0.9029 | 0.9110 |

악성 댓글 필터라는 목적에서 중요한 지표는 악성 클래스의 재현율이다. 실제 악성 댓글의 9.7%(131개)가 정상으로 통과했고, 정상 댓글의 6.1%(107개)가 악성으로 차단되었다.

![평가 결과 딕셔너리 출력과 정확도 92% 도식, 향후 과제](./images/dl-toxic-comment-kcelectra-15.jpg '테스트 세트 평가 결과 (발표 자료)')

### 새 문장 분류

학습한 모델에 새 댓글을 입력해 소프트맥스 확률과 판정을 출력하는 함수를 만들었다.

```python
def sentence_predict(sent):
    model.eval()
    tokenized_sent = tokenizer(sent, return_tensors="pt", truncation=True,
                               add_special_tokens=True, max_length=128)
    tokenized_sent.to(device)

    with torch.no_grad():
        outputs = model(input_ids=tokenized_sent["input_ids"],
                        attention_mask=tokenized_sent["attention_mask"],
                        token_type_ids=tokenized_sent["token_type_ids"])

    logits = outputs.logits.detach().cpu()
    result = logits.argmax(-1).item()
    probabilities = torch.nn.functional.softmax(logits, dim=1)[0].tolist()
    print(f"확률 분포: 악플({probabilities[0]:.4f}), 정상({probabilities[1]:.4f})")
    return "악성 댓글" if result == 0 else "정상 댓글"
```

| 입력                                         | 악플 확률 | 판정 | 관찰                                   |
| -------------------------------------------- | --------- | ---- | -------------------------------------- |
| 야 이 ㅂ##$#$!$!!##$ㅅ아 그걸 말이라고 하냐? | 0.9997    | 악성 | 욕설 사이 특수문자 우회 탐지           |
| 에휴 진짜 노답이네ㅋㅋ                       | 0.9997    | 악성 | 비하 표현                              |
| 사람마다 입맛이다른데 ㅅㅂㄹㅁ               | 0.9997    | 악성 | 초성 욕설 탐지                         |
| 어제부터 오늘까지 1+1 행사하는데 사람 많음   | 0.0001    | 정상 |                                        |
| 격공감합니다.                                | 0.0001    | 정상 |                                        |
| ㅋㅋㅋㅋㅋㅋㅋㅋㅋ 아 진짜 ㄱㅇㄱ            | 0.0003    | 정상 | 초성이지만 악의 없는 표현              |
| 옛말에 암탉이 울면 나라가 망한다 했다ㅋㅋ    | 0.9991    | 악성 | 욕설 없는 성차별 표현 탐지             |
| 와...지렸다                                  | 0.0002    | 정상 | 비속어지만 감탄 의미                   |
| 착짱죽짱                                     | 0.9996    | 악성 | 혐오 줄임말 탐지                       |
| 와 대박ㅋㅋㅋㅋ 진짜 미친 거 아님?? 개쩐다   | 0.0009    | 정상 | '미친', '개'가 있어도 강조 의미로 판단 |

![여러 댓글을 입력해 악플·정상 확률과 판정을 출력한 화면](./images/dl-toxic-comment-kcelectra-11.jpg '새 문장 분류 시연 (발표 자료)')

욕설 사이에 특수문자를 넣거나 초성만 쓴 우회 표현, '착짱죽짱' 같은 혐오 줄임말, 직접적인 욕설 없이 편견을 담은 문장을 악성으로 분류했다. 반대로 '미친', '지렸다'처럼 비속어가 있어도 비하 의미가 없는 문장은 정상으로 분류해, 데이터셋의 분류 기준을 학습했음을 확인했다.

## 분석과 한계

### 과적합과 과신

평균 학습 손실은 0.106인데 테스트 손실은 0.555로 5배 이상 크다. 정확도는 92%로 높지만 손실이 큰 이유는 틀린 문장에서도 0.999에 가까운 확률로 확신하기 때문이다. 교차 엔트로피는 확신하고 틀린 예측에 `-\log(0.0003) \approx 8.1{:math}` 같은 큰 손실을 매긴다. 시연 결과도 대부분 0.9991 이상으로, 확률 값이 판단의 신뢰도를 반영하지 못한다.

> [!IMPORTANT] 검증 세트 없이 10에폭
> 중간 평가 없이 10에폭을 학습해 마지막 체크포인트를 그대로 사용했다. 학습 세트에서 검증 세트를 따로 떼어 `evaluation_strategy="epoch"`, `load_best_model_at_end=True`로 검증 손실이 가장 낮은 에폭을 고르거나, 미세 조정에서 흔히 쓰는 2~4에폭으로 줄이면 과적합을 줄일 수 있다. 또한 테스트 세트를 `eval_dataset`으로 넘겨 학습 과정에 노출하면 하이퍼파라미터 선택에 테스트 세트가 쓰여 성능이 낙관적으로 추정된다.

### 데이터 처리의 문제

| 문제                    | 원인                                                       | 영향                                                     | 개선                                      |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- |
| 첫 문장 손실            | 데이터셋 2를 `header=None` 없이 읽음                       | 1문장이 열 이름이 되어 학습에서 빠짐                     | `header=None, names=['content', 'label']` |
| 세트 간 중복            | 분할 후 각 세트 안에서만 중복 삭제                         | 학습 세트와 같은 문장이 테스트에 남아 성능 과대평가 가능 | 분할 전에 전체에서 중복 삭제              |
| 라벨 충돌 미확인        | 본문만 기준으로 첫 행을 남김                               | 같은 문장에 다른 라벨이 있으면 임의로 하나만 남음        | 라벨까지 비교해 충돌 문장 확인            |
| 두 데이터셋의 기준 차이 | 출처와 라벨링 주체가 다름                                  | 같은 표현이 데이터셋마다 다르게 라벨링될 수 있음         | 출처별 성능을 따로 집계                   |
| 정제 함수 미적용        | KcELECTRA 권장 `clean` 함수(반복 문자 축약 등)를 쓰지 않음 | `ㅋㅋㅋㅋㅋㅋ` 같은 반복이 그대로 토큰화됨               | 사전 학습과 같은 정제 적용                |

### 판정 함수의 죽은 분기

노트북의 `sentence_predict`에는 `result == 1`인데 정상 확률이 0.5 미만이면 "악성 의심 댓글"로 표시하는 분기가 있었다. 그러나 클래스가 두 개이면 argmax가 1인 시각에 정상 확률은 항상 0.5 이상이므로 이 분기는 실행되지 않는다. 의심 구간을 두려면 `0.3 < p_{\text{악성}} < 0.7{:math}`처럼 확률 임계값으로 판정해야 하고, 그 전에 온도 스케일링 같은 보정으로 과신을 줄여야 임계값이 의미를 가진다.

### 향후 과제

현재 모델은 문장 전체를 악성 또는 정상으로만 분류한다. 발표에서 향후 과제로 제시한 대로, 모델의 어텐션 가중치나 토큰별 기여도를 이용해 문장 전체가 아니라 욕설에 해당하는 토큰만 가리는 마스킹으로 확장할 수 있다. 다만 어텐션 가중치가 곧 판단 근거라는 보장은 없으므로, [CNN 시각화 글](/memo/dl-cnn-transfer-learning)의 Grad-CAM처럼 기울기 기반 기여도 방법과 함께 검증해야 한다.
