---
title: '[실기] Java와 Python 코드 읽기, 상속과 동적 바인딩에서 슬라이싱과 컴프리헨션까지'
date: 2024-04-24
category: 학습/자격증/정보처리기사
series: 정보처리기사
seriesOrder: 14
summary: 정보처리기사 실기의 Java·Python 출력값 문제를 대비해 클래스와 생성자, 상속과 동적 바인딩, static, 문자열 비교, 예외 처리 순서, 파이썬 자료구조와 슬라이싱, 컴프리헨션, 문자열 메서드, lambda, 클래스를 직접 실행한 예제와 추적 표로 정리했다.
---

## 들어가기 전에

정보처리기사 실기의 "프로그래밍 언어 활용" 영역은 코드를 주고 출력값을 쓰게 하는 문제로 나온다. [앞 글](/memo/eip-practical-c)에서 다룬 C에 이어, 이 글은 Java와 Python을 다룬다. 두 언어에서 묻는 내용은 성격이 조금 다르다.

| 언어   | 주로 묻는 내용                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| Java   | 객체 지향 문법: 생성자 호출 순서, 상속과 오버라이딩, 부모 타입 참조로 호출한 메서드, static, 예외 처리 순서 |
| Python | 내장 자료구조와 문법: 리스트·딕셔너리·세트 연산, 슬라이싱, range, 컴프리헨션, 문자열 메서드, lambda         |

Java 문제는 "어느 클래스의 어느 메서드가 실행되는가"를 정확히 추적하는 능력을, Python 문제는 "한 줄짜리 표현식이 무엇을 만들어 내는가"를 정확히 계산하는 능력을 평가한다. C와 마찬가지로 공백, 줄바꿈, 따옴표, 대괄호까지 출력 그대로 써야 정답이다. 예를 들어 Python에서 리스트를 출력하면 `[1, 2, 3]`처럼 쉼표 뒤에 공백이 붙는데, 이것을 `[1,2,3]`으로 쓰면 오답이 될 수 있다.

이 글의 예제는 모두 직접 작성했고, 출력값은 OpenJDK(`java Main.java`로 소스 파일을 바로 실행)와 Python 3(`python3`)으로 실제 실행한 결과다.

| 순서 | 내용                                               |
| ---- | -------------------------------------------------- |
| 1    | Java 클래스와 객체, 참조                           |
| 2    | 생성자, this, super와 호출 순서                    |
| 3    | 상속, 오버라이딩, 동적 바인딩, 오버로딩            |
| 4    | static 멤버, 추상 클래스와 인터페이스              |
| 5    | 문자열 비교(== 와 equals), 배열                    |
| 6    | 예외 처리(try, catch, finally 실행 순서)           |
| 7    | Python 자료구조: 리스트, 튜플, 딕셔너리, 세트      |
| 8    | 슬라이싱, range, 컴프리헨션                        |
| 9    | 문자열 메서드, 함수와 기본 인자, lambda·map·filter |
| 10   | Python 클래스와 self                               |

## Java: 클래스와 객체

### 참조 변수는 객체의 주소를 담는다

클래스(class)는 데이터(필드, field)와 동작(메서드, method)을 묶은 설계도이고, 객체(object)는 그 설계도로 `new`를 실행해 메모리(힙, heap)에 실제로 만든 것이다. Java에서 클래스 타입의 변수는 객체 자체가 아니라 ==객체가 있는 위치를 가리키는 참조(reference)==를 담는다. 그래서 `c2 = c1`은 객체를 복사하지 않고 같은 객체를 가리키는 참조를 하나 더 만든다.

```java
class Counter {
    int count;

    void up() {
        count++;
    }
}

public class Main {
    public static void main(String[] args) {
        Counter c1 = new Counter();
        Counter c2 = c1;
        Counter c3 = new Counter();
        c1.up();
        c2.up();
        c3.up();
        System.out.println(c1.count + " " + c2.count + " " + c3.count);
        System.out.println((c1 == c2) + " " + (c1 == c3));
    }
}
```

```text
2 2 1
true false
```

![스택의 참조 변수 c1, c2는 힙의 Counter 객체 #1(count = 2)을, c3는 Counter 객체 #2(count = 1)를 가리키는 화살표로 그린 도식](./images/eip-practical-java-python-object-reference.svg 'c1과 c2는 화살표만 둘이고 객체는 하나다')

| 실행 문장 | 객체 #1의 count | 객체 #2의 count |
| --------- | --------------- | --------------- |
| 생성 직후 | 0               | 0               |
| `c1.up()` | 1               | 0               |
| `c2.up()` | 2               | 0               |
| `c3.up()` | 2               | 1               |

필드 `count`에 초기값을 쓰지 않았는데 0에서 시작하는 이유는, Java가 객체의 필드를 자료형의 기본값(정수 0, 실수 0.0, boolean false, 참조 null)으로 자동 초기화하기 때문이다. 메서드 안의 지역 변수는 자동 초기화되지 않아서, 값을 넣지 않고 읽으면 컴파일 오류가 난다.

객체를 비교하는 `==`는 두 참조가 같은 객체를 가리키는지를 비교한다. c1과 c2는 같은 객체라서 true, c1과 c3는 내용(count)과 상관없이 서로 다른 객체라서 false다. 이 규칙은 뒤에서 다룰 문자열 비교 문제의 바탕이 된다.

### 생성자와 this, super

생성자(constructor)는 `new`로 객체를 만들 때 자동으로 실행되는 특수한 메서드다. 이름이 클래스 이름과 같고 반환 타입을 쓰지 않는다. 생성자를 하나도 쓰지 않으면 컴파일러가 매개변수 없는 기본 생성자를 만들어 준다.

| 키워드       | 뜻                                        | 예                        |
| ------------ | ----------------------------------------- | ------------------------- |
| `this`       | 현재 객체 자신의 참조                     | `this.x = x;`             |
| `this(...)`  | 같은 클래스의 다른 생성자 호출(첫 줄에만) | `this();`                 |
| `super`      | 부모 클래스 부분의 참조                   | `super.x`, `super.show()` |
| `super(...)` | 부모 클래스의 생성자 호출(첫 줄에만)      | `super(5);`               |

상속 관계에서 자식 객체를 만들면 ==부모 생성자가 먼저 끝나고 자식 생성자의 본문이 실행==된다. 자식 생성자의 첫 줄에 `super(...)`나 `this(...)`가 없으면 컴파일러가 `super();`를 넣는다. 그래서 부모 클래스에 매개변수 없는 생성자가 없으면 자식 클래스가 컴파일되지 않는다.

```java
class Parent {
    int x = 10;

    Parent() {
        System.out.println("Parent()");
    }

    Parent(int x) {
        this();
        this.x = x;
        System.out.println("Parent(int) x=" + this.x);
    }
}

class Child extends Parent {
    int x = 20;

    Child() {
        super(5);
        System.out.println("Child() x=" + x + " super.x=" + super.x);
    }
}

public class Main {
    public static void main(String[] args) {
        new Child();
    }
}
```

```text
Parent()
Parent(int) x=5
Child() x=20 super.x=5
```

![Child()가 super(5)로 Parent(int x)를 호출하고, Parent(int x)가 this()로 Parent()를 호출하는 호출 화살표와, 출력이 Parent()부터 1, 2, 3 순서로 아래에서 위로 일어나는 모습을 그린 도식](./images/eip-practical-java-python-constructor-chain.svg '호출은 위에서 아래로, 출력은 아래에서 위로')

| 단계 | 실행 위치       | 하는 일                             | 출력                     |
| ---- | --------------- | ----------------------------------- | ------------------------ |
| 1    | `Child()`       | 첫 줄 `super(5)` → Parent(int) 호출 |                          |
| 2    | `Parent(int x)` | 첫 줄 `this()` → Parent() 호출      |                          |
| 3    | `Parent()`      | 본문 실행                           | `Parent()`               |
| 4    | `Parent(int x)` | `this.x = 5` 후 출력                | `Parent(int) x=5`        |
| 5    | `Child()`       | 출력                                | `Child() x=20 super.x=5` |

`Parent(int x)` 안의 `this.x = x`에서 왼쪽 `this.x`는 필드, 오른쪽 `x`는 매개변수다. 매개변수 이름이 필드 이름을 가리기 때문에 `this.`를 붙여 필드를 지정한다. 또 Child와 Parent가 모두 `x`라는 필드를 가지고 있는데, 이 둘은 이름만 같은 별개의 변수다. Child 안에서 그냥 `x`는 Child의 필드(20), `super.x`는 Parent의 필드(5)다.

시험에서는 이처럼 `this()`와 `super()`가 섞인 생성자 사슬의 출력 순서를 묻는다. 호출을 따라 가장 깊은 곳까지 내려간 뒤, 거기서부터 거꾸로 출력을 적어 올라오면 된다.

## Java: 상속과 다형성

### 오버라이딩과 동적 바인딩

상속(inheritance)은 `extends`로 부모 클래스의 필드와 메서드를 물려받는 것이다. 자식 클래스가 부모의 메서드와 ==이름, 매개변수, 반환 타입이 같은 메서드를 다시 정의==하면 오버라이딩(overriding, 재정의)이라고 한다. `@Override` 표시는 선택 사항이지만, 붙이면 컴파일러가 재정의가 맞는지 검사한다.

Java에서는 부모 타입의 변수에 자식 객체를 담을 수 있다(`Animal a = new Dog();`). 이 상태에서 `a.sound()`를 호출하면 변수의 타입(Animal)이 아니라 ==실제 객체(Dog)의 메서드==가 실행된다. 어느 메서드를 실행할지 프로그램 실행 중에 실제 객체를 확인해서 정하므로 동적 바인딩(dynamic binding)이라고 한다. 하나의 호출 코드가 객체에 따라 다르게 동작하는 성질을 다형성(polymorphism)이라고 부른다.

```java
class Animal {
    String name = "animal";

    void sound() {
        System.out.println("...");
    }

    void intro() {
        System.out.print(name + ": ");
        sound();
    }
}

class Dog extends Animal {
    String name = "dog";

    @Override
    void sound() {
        System.out.println("bark");
    }

    void fetch() {
        System.out.println("fetch");
    }
}

class Cat extends Animal {
    @Override
    void sound() {
        System.out.println("meow");
    }
}

public class Main {
    public static void main(String[] args) {
        Animal a = new Dog();
        a.sound();
        a.intro();
        System.out.println(a.name);
        Animal[] zoo = {new Animal(), new Dog(), new Cat()};
        for (Animal z : zoo) {
            z.sound();
        }
    }
}
```

```text
bark
animal: bark
animal
...
bark
meow
```

![Animal 타입 변수 a가 Dog 객체를 가리키고, Dog 객체 안의 Animal에서 물려받은 부분(name = "animal", 가려진 sound)과 Dog에서 추가한 부분(name = "dog", 재정의한 sound)으로 나뉜 모습. a.sound()는 Dog의 sound로, a.name은 Animal의 name으로 연결된다](./images/eip-practical-java-python-dynamic-binding.svg '메서드는 실제 객체를 따르고, 필드는 변수의 타입을 따른다')

| 호출           | 결정 기준                  | 실행되는 것              | 출력                   |
| -------------- | -------------------------- | ------------------------ | ---------------------- |
| `a.sound()`    | 실제 객체 Dog              | `Dog.sound()`            | `bark`                 |
| `a.intro()`    | Dog에 없으므로 Animal의 것 | `Animal.intro()`         | `animal: ` 다음 `bark` |
| `a.name`       | 변수 타입 Animal           | Animal의 필드            | `animal`               |
| `z.sound()` ×3 | 각 원소의 실제 객체        | Animal, Dog, Cat의 sound | `...`, `bark`, `meow`  |

두 번째 줄 `animal: bark`가 이 예제의 핵심이다. `intro()`는 Animal에 정의된 메서드라서 그 안의 `name`은 Animal의 필드 `"animal"`이다. 하지만 `intro()` 안에서 호출한 `sound()`는 동적 바인딩에 따라 실제 객체인 Dog의 `sound()`가 실행된다. ==필드는 재정의되지 않고 가려질 뿐==이고(이를 필드 숨김, field hiding이라고 한다), 메서드만 재정의된다.

> [!WARNING] 부모 타입 변수로는 자식에만 있는 메서드를 호출할 수 없다
>
> `a.fetch()`는 컴파일 오류다. 컴파일러는 a의 타입이 Animal이라는 것만 알고, Animal에는 `fetch()`가 없기 때문이다. 호출하려면 `((Dog) a).fetch()`처럼 자식 타입으로 형 변환(다운캐스팅)해야 한다. "어느 메서드를 호출할 수 있는가"는 변수 타입이, "실제로 어느 메서드가 실행되는가"는 객체가 정한다.

부모의 메서드를 재정의하면서 부모의 원래 동작도 쓰고 싶으면 `super.메서드()`로 호출한다. 그리고 `static` 메서드는 객체가 아니라 클래스에 속하므로 재정의되지 않는다. 자식 클래스에 같은 이름의 static 메서드를 만들면 부모의 것을 가리기만 한다.

```java
class A {
    static String who() {
        return "A.who";
    }

    String show() {
        return "A.show";
    }
}

class B extends A {
    static String who() {
        return "B.who";
    }

    @Override
    String show() {
        return super.show() + "+B.show";
    }
}

public class Main {
    public static void main(String[] args) {
        A x = new B();
        System.out.println(x.show());
        System.out.println(A.who() + " " + B.who());
    }
}
```

```text
A.show+B.show
A.who B.who
```

`x.show()`는 동적 바인딩으로 B의 `show()`가 실행되고, 그 안의 `super.show()`가 A의 `show()`를 호출해 `"A.show"`를 받아 뒤에 `"+B.show"`를 붙인다.

### 오버로딩

오버로딩(overloading)은 ==한 클래스 안에 이름은 같고 매개변수의 개수나 타입이 다른 메서드를 여러 개 정의==하는 것이다. 어느 메서드를 호출할지는 컴파일 시각에 인자의 개수와 타입으로 결정한다. 반환 타입만 다른 메서드는 오버로딩으로 인정되지 않아 컴파일 오류가 난다.

```java
class Calc {
    int add(int a, int b) {
        return a + b;
    }

    double add(double a, double b) {
        return a + b + 0.5;
    }

    String add(String a, int b) {
        return a + b;
    }

    int add(int a, int b, int c) {
        return a + b + c;
    }
}

public class Main {
    public static void main(String[] args) {
        Calc c = new Calc();
        System.out.println(c.add(1, 2));
        System.out.println(c.add(1.0, 2));
        System.out.println(c.add("A", 1 + 2));
        System.out.println(c.add(1, 2, 3));
        System.out.println("A" + 1 + 2);
        System.out.println(1 + 2 + "A");
    }
}
```

```text
3
3.5
A3
6
A12
3A
```

![호출 네 개(c.add(1, 2), c.add(1.0, 2), c.add("A", 1 + 2), c.add(1, 2, 3))가 각각 int add(int, int), double add(double, double), String add(String, int), int add(int, int, int)로 연결되고 결과 3, 3.5, A3, 6이 나오는 도식](./images/eip-practical-java-python-overloading.svg '인자의 타입과 개수가 호출할 메서드를 정한다')

`c.add(1.0, 2)`에 딱 맞는 `add(double, int)`는 없다. 이 경우 Java는 int 2를 double 2.0으로 자동 변환(widening)할 수 있는 `add(double, double)`을 고르고, 그 메서드가 0.5를 더하므로 3.5가 된다.

마지막 두 줄은 문자열 연결의 함정이다. `+`는 왼쪽부터 계산하고, 한쪽이 문자열이면 다른 쪽을 문자열로 바꿔 이어 붙인다.

| 식              | 계산 순서                      | 결과  |
| --------------- | ------------------------------ | ----- |
| `"A" + 1 + 2`   | `"A" + 1` = `"A1"`, `"A1" + 2` | `A12` |
| `1 + 2 + "A"`   | `1 + 2` = 3, `3 + "A"`         | `3A`  |
| `"A" + (1 + 2)` | 괄호 먼저 3, `"A" + 3`         | `A3`  |

| 구분        | 오버로딩                          | 오버라이딩             |
| ----------- | --------------------------------- | ---------------------- |
| 위치        | 같은 클래스(또는 상속 관계)       | 부모와 자식 클래스     |
| 메서드 이름 | 같음                              | 같음                   |
| 매개변수    | ==달라야 함==(개수 또는 타입)     | ==같아야 함==          |
| 반환 타입   | 상관없음(반환 타입만 다르면 오류) | 같아야 함              |
| 결정 시각   | 컴파일 시각                       | 실행 시각(동적 바인딩) |

시험에서는 두 용어를 설명문과 짝짓게 하거나, 같은 이름의 메서드가 여러 개인 코드에서 어느 것이 호출되는지를 묻는다.

## Java: static, 추상 클래스, 인터페이스

### static 멤버

`static`을 붙인 필드는 객체마다 따로 생기지 않고 ==클래스에 하나만 존재하며 모든 객체가 공유==한다. 그래서 클래스 변수라고도 부르고, 객체마다 따로 있는 일반 필드는 인스턴스 변수라고 부른다. static 필드와 메서드는 객체 없이 `클래스이름.멤버`로 사용할 수 있다. static 메서드 안에서는 `this`가 없으므로 인스턴스 변수를 직접 사용할 수 없다.

```java
class Member {
    static int total = 0;
    int id;

    Member() {
        total++;
        id = total;
    }

    static int getTotal() {
        return total;
    }
}

public class Main {
    public static void main(String[] args) {
        Member m1 = new Member();
        Member m2 = new Member();
        Member m3 = new Member();
        System.out.println(m1.id + " " + m2.id + " " + m3.id);
        System.out.println(Member.total + " " + m1.total + " " + Member.getTotal());
    }
}
```

```text
1 2 3
3 3 3
```

![Member 클래스 영역에 static total = 3이 하나 있고, m1(id = 1), m2(id = 2), m3(id = 3) 세 객체가 모두 그 하나를 점선 화살표로 가리키는 도식](./images/eip-practical-java-python-static-member.svg 'total은 하나, id는 객체마다 하나')

| 실행 문장           | total | 새 객체의 id |
| ------------------- | ----- | ------------ |
| `new Member()` → m1 | 1     | 1            |
| `new Member()` → m2 | 2     | 2            |
| `new Member()` → m3 | 3     | 3            |

`m1.total`처럼 객체를 통해 static 필드에 접근해도 같은 변수 하나를 가리킨다(javac의 `-Xlint` 옵션이나 IDE는 경고를 표시한다). 그래서 m1, m2, m3 어느 쪽으로 읽어도 3이다. `main` 메서드에 `static`이 붙는 이유도 같다. 프로그램을 시작하는 시각에는 아직 객체가 없으므로, JVM이 객체 없이 호출할 수 있어야 하기 때문이다.

### 추상 클래스와 인터페이스

추상 메서드(abstract method)는 본문 없이 선언만 있는 메서드다. 추상 메서드가 하나라도 있는 클래스는 `abstract`를 붙인 추상 클래스(abstract class)가 되고, `new`로 객체를 만들 수 없다. 자식 클래스가 추상 메서드를 모두 구현(오버라이딩)해야 객체를 만들 수 있다.

인터페이스(interface)는 클래스가 반드시 구현해야 할 메서드의 목록을 정한 것이다. 인터페이스의 메서드는 기본적으로 `public abstract`이고, 필드는 자동으로 `public static final` 상수다. Java 8부터는 본문이 있는 `default` 메서드도 정의할 수 있다. 클래스는 `extends`로 부모 클래스를 ==하나만== 상속할 수 있지만, `implements`로 인터페이스는 ==여러 개== 구현할 수 있다.

```java
abstract class Shape {
    abstract double area();

    void print() {
        System.out.println(getClass().getSimpleName() + " " + area());
    }
}

interface Drawable {
    int LINE = 2;

    void draw();

    default void info() {
        System.out.println("line=" + LINE);
    }
}

class Rect extends Shape implements Drawable {
    int w, h;

    Rect(int w, int h) {
        this.w = w;
        this.h = h;
    }

    double area() {
        return w * h;
    }

    public void draw() {
        System.out.println("draw " + w + "x" + h);
    }
}

class Circle extends Shape {
    int r;

    Circle(int r) {
        this.r = r;
    }

    double area() {
        return 3 * r * r;
    }
}

public class Main {
    public static void main(String[] args) {
        Shape[] list = {new Rect(2, 3), new Circle(2)};
        for (Shape s : list) {
            s.print();
        }
        Drawable d = new Rect(4, 5);
        d.draw();
        d.info();
    }
}
```

```text
Rect 6.0
Circle 12.0
draw 4x5
line=2
```

![추상 클래스 Shape(abstract double area(), void print())와 인터페이스 Drawable(int LINE = 2, void draw())을 위에, Circle과 Rect를 아래에 두고 Circle과 Rect가 Shape를 extends, Rect가 Drawable을 implements하는 관계를 실선과 점선 화살표로 그린 클래스 관계도](./images/eip-practical-java-python-abstract-interface.svg 'Rect는 부모 클래스 하나와 인터페이스 하나를 함께 가진다')

`print()`는 Shape에 정의되어 있지만, 그 안에서 호출하는 `area()`는 동적 바인딩으로 실제 객체의 것이 실행된다. Rect의 `area()`는 `w * h`가 int 6인데 반환 타입이 double이라 6.0으로 바뀌고, 출력도 `6.0`이 된다. 출력값 문제에서 반환 타입 때문에 `.0`이 붙는 경우를 놓치기 쉽다.

인터페이스의 메서드는 public이므로, 구현하는 쪽의 `draw()`에도 `public`을 붙여야 한다. 재정의할 때 접근 범위를 좁힐 수 없다는 규칙 때문이다.

| 구분      | 추상 클래스                 | 인터페이스                         |
| --------- | --------------------------- | ---------------------------------- |
| 키워드    | `abstract class`, `extends` | `interface`, `implements`          |
| 다중 상속 | 불가(하나만)                | 가능(여러 개)                      |
| 필드      | 일반 필드 가능              | 상수(`public static final`)만      |
| 메서드    | 일반 메서드 + 추상 메서드   | 추상 메서드, default·static 메서드 |
| 생성자    | 있음(자식이 super로 호출)   | 없음                               |
| 객체 생성 | 불가                        | 불가                               |

## Java: 문자열 비교와 배열

### == 와 equals

`String`은 클래스이므로 문자열 변수도 참조를 담는다. `==`는 두 변수가 ==같은 객체를 가리키는지==를, `equals()`는 두 문자열의 ==내용이 같은지==를 비교한다. 결과가 헷갈리는 이유는 문자열 상수 풀(string constant pool) 때문이다. 소스 코드에 따옴표로 쓴 문자열 리터럴은 JVM이 풀에 하나만 만들어 보관하고 같은 내용의 리터럴이 다시 나오면 그 객체를 재사용한다. 반면 `new String(...)`은 항상 새 객체를 만든다.

```java
public class Main {
    public static void main(String[] args) {
        String a = "java";
        String b = "java";
        String c = new String("java");
        String d = c.intern();
        String e = "ja" + "va";
        String part = "ja";
        String f = part + "va";
        System.out.println(a == b);
        System.out.println(a == c);
        System.out.println(a.equals(c));
        System.out.println(a == d);
        System.out.println(a == e);
        System.out.println(a == f);
        System.out.println(a.equals(f));
    }
}
```

```text
true
false
true
true
true
false
true
```

![변수 a, b, d, e는 문자열 상수 풀의 "java" 객체 하나를 가리키고, c는 new String으로 만든 힙의 다른 "java" 객체를, f는 실행 중 연결로 만든 또 다른 "java" 객체를 가리키는 도식](./images/eip-practical-java-python-string-pool.svg '내용이 같아도 객체가 다르면 == 는 false')

| 비교          | 결과  | 이유                                                  |
| ------------- | ----- | ----------------------------------------------------- |
| `a == b`      | true  | 같은 리터럴이라 풀의 같은 객체                        |
| `a == c`      | false | `new`로 만든 별도 객체                                |
| `a.equals(c)` | true  | 내용이 같음                                           |
| `a == d`      | true  | `intern()`은 풀에 있는 같은 내용의 객체를 돌려줌      |
| `a == e`      | true  | 상수끼리의 `+`는 컴파일 시각에 `"java"` 하나로 합쳐짐 |
| `a == f`      | false | 변수가 낀 `+`는 실행 중에 새 객체를 만듦              |
| `a.equals(f)` | true  | 내용이 같음                                           |

> [!TIP] 문자열 비교 문제의 판단 순서
>
> 1. `equals`면 내용만 확인한다. 내용이 같으면 true다.
> 2. `==`면 두 변수가 리터럴(또는 상수끼리 연결, `intern()`)로 만들어졌는지 확인한다. 둘 다 그렇고 내용이 같으면 true다.
> 3. 어느 한쪽이라도 `new String`이거나 변수를 낀 연결로 만들어졌으면 false다.

### 배열

Java의 배열도 객체다. `int[] a = {5, 3, 8, 1, 4};`에서 a는 배열 객체의 참조이고, 길이는 `a.length`(괄호 없는 필드)로 읽는다. 문자열의 길이는 `str.length()`(메서드)라서 괄호 유무가 다르다. 배열 변수를 다른 변수에 대입하면 참조만 복사되므로, 한쪽으로 원소를 바꾸면 다른 쪽에서도 바뀐 값이 보인다.

```java
public class Main {
    public static void main(String[] args) {
        int[] a = {5, 3, 8, 1, 4};
        int[] b = a;
        b[0] = 9;
        System.out.println(a[0] + " " + a.length);
        for (int i = 0; i < a.length - 1; i++) {
            for (int j = 0; j < a.length - 1 - i; j++) {
                if (a[j] > a[j + 1]) {
                    int t = a[j];
                    a[j] = a[j + 1];
                    a[j + 1] = t;
                }
            }
        }
        for (int v : a) System.out.print(v + " ");
        System.out.println();
        int[][] m = new int[3][];
        for (int i = 0; i < 3; i++) {
            m[i] = new int[i + 1];
            for (int j = 0; j <= i; j++) m[i][j] = i + j;
        }
        System.out.println(m[2].length + " " + m[2][1]);
    }
}
```

```text
9 5
1 3 4 8 9
3 3
```

가운데 이중 반복문은 버블 정렬(bubble sort)이다. 이웃한 두 원소를 비교해 앞이 크면 자리를 바꾸는 과정을 반복하면, 한 바퀴(pass)마다 가장 큰 값이 맨 뒤로 이동한다. `b[0] = 9` 이후 배열은 `[9, 3, 8, 1, 4]`에서 시작한다.

| 바퀴 i | 비교와 교환                  | 바퀴가 끝난 뒤 배열 |
| ------ | ---------------------------- | ------------------- |
| 0      | 9↔3, 9↔8, 9↔1, 9↔4 모두 교환 | `[3, 8, 1, 4, 9]`   |
| 1      | 3·8 그대로, 8↔1, 8↔4 교환    | `[3, 1, 4, 8, 9]`   |
| 2      | 3↔1 교환, 3·4 그대로         | `[1, 3, 4, 8, 9]`   |
| 3      | 1·3 그대로                   | `[1, 3, 4, 8, 9]`   |

안쪽 반복의 끝이 `a.length - 1 - i`인 이유는, i번째 바퀴가 끝나면 뒤쪽 i + 1개는 이미 자리를 찾았으므로 다시 비교할 필요가 없기 때문이다. 향상된 for문(`for (int v : a)`)은 배열의 원소를 처음부터 하나씩 v에 담아 반복한다.

마지막 부분은 행마다 길이가 다른 2차원 배열이다. `new int[3][]`로 행 3개만 만들고, 각 행을 `new int[i + 1]`로 따로 만든다. 2행은 길이 3이고 `m[2][1]`은 `2 + 1 = 3`이다. C의 2차원 배열은 메모리에 한 줄로 이어져 있지만, Java의 2차원 배열은 "배열의 참조를 담은 배열"이라서 행마다 길이가 달라도 된다.

## Java: 예외 처리

예외(exception)는 실행 중에 발생한 오류 상황을 나타내는 객체다. 0으로 나누면 `ArithmeticException`, 배열 범위를 벗어나면 `ArrayIndexOutOfBoundsException`, null 참조로 메서드를 호출하면 `NullPointerException`이 발생한다. `try` 블록에서 예외가 발생하면 ==남은 try 문장을 건너뛰고== 예외 타입이 맞는 첫 번째 `catch` 블록으로 이동한다. `finally` 블록은 예외 발생 여부와 상관없이, 심지어 try나 catch에서 `return`을 만나도 메서드가 끝나기 직전에 반드시 실행된다.

```java
public class Main {
    static int test(int n) {
        try {
            System.out.println("try " + n);
            int r = 10 / n;
            System.out.println("result " + r);
            return r;
        } catch (ArithmeticException e) {
            System.out.println("catch " + e.getMessage());
            return -1;
        } finally {
            System.out.println("finally " + n);
        }
    }

    public static void main(String[] args) {
        System.out.println(test(2));
        System.out.println(test(0));
        try {
            int[] arr = new int[3];
            arr[3] = 1;
            System.out.println("A");
        } catch (ArithmeticException e) {
            System.out.println("B");
        } catch (Exception e) {
            System.out.println("C " + e.getClass().getSimpleName());
        } finally {
            System.out.println("D");
        }
        System.out.println("E");
    }
}
```

```text
try 2
result 5
finally 2
5
try 0
catch / by zero
finally 0
-1
C ArrayIndexOutOfBoundsException
D
E
```

![왼쪽 test(2)는 try 출력, 나눗셈, result 출력과 return 예약, catch 건너뜀, finally 출력, 반환값 출력 순서이고, 오른쪽 test(0)은 try 출력, 0으로 나눠 예외 발생, 남은 try 건너뜀, catch 출력, finally 출력, 반환값 -1 출력 순서인 두 흐름도](./images/eip-practical-java-python-try-catch-finally.svg 'finally는 return보다 나중에, 반환값 출력보다 먼저 실행된다')

| 출력 줄 | 출력                               | 어디서                                     |
| ------- | ---------------------------------- | ------------------------------------------ |
| 1       | `try 2`                            | test(2)의 try                              |
| 2       | `result 5`                         | test(2)의 try, 이어서 `return 5` 예약      |
| 3       | `finally 2`                        | 반환 직전 finally                          |
| 4       | `5`                                | main이 반환값 출력                         |
| 5       | `try 0`                            | test(0)의 try                              |
| 6       | `catch / by zero`                  | 10 / 0에서 예외, result 줄은 건너뜀        |
| 7       | `finally 0`                        | catch의 `return -1` 직전 finally           |
| 8       | `-1`                               | main이 반환값 출력                         |
| 9       | `C ArrayIndexOutOfBoundsException` | 첫 catch는 타입이 달라 통과, 두 번째 catch |
| 10      | `D`                                | finally                                    |
| 11      | `E`                                | 예외가 처리되었으므로 정상 진행            |

가장 많이 틀리는 곳은 4번째 줄과 3번째 줄의 순서다. `return r;`을 만나는 시각에 반환할 값 5가 정해지지만, 메서드가 실제로 끝나기 전에 finally가 먼저 실행된다. 그래서 `finally 2`가 출력된 다음에 main에서 5가 출력된다.

catch 블록은 위에서부터 차례로 검사해 ==처음 일치하는 하나만== 실행한다. `Exception`은 거의 모든 예외의 부모 클래스이므로 마지막에 쓴다. 부모 타입의 catch를 자식 타입보다 위에 쓰면, 아래 catch에 절대 도달하지 못하므로 컴파일 오류가 난다.

> [!NOTE] 예외 계층
>
> `Throwable` 아래에 `Error`(메모리 부족처럼 프로그램이 복구할 수 없는 오류)와 `Exception`이 있다. `Exception` 중 `RuntimeException`의 자식(ArithmeticException, NullPointerException, ArrayIndexOutOfBoundsException 등)은 처리하지 않아도 컴파일되는 비검사 예외(unchecked exception)이고, 나머지(IOException 등)는 반드시 catch하거나 `throws`로 선언해야 하는 검사 예외(checked exception)다.

## Python: 기본 자료구조

Python은 변수 선언 없이 값을 대입하면 변수가 만들어지고, 변수의 자료형은 담긴 값에 따라 정해진다. 실기에 나오는 Python 문제는 대부분 내장 자료구조 네 가지(리스트, 튜플, 딕셔너리, 세트)를 다룬다.

![list [1, 2, 2], tuple (1, 2, 2), dict {"a": 1}, set {1, 2} 네 카드에 순서 유무, 변경 가능 여부, 중복 허용 여부와 대표 메서드를 적은 비교 그림](./images/eip-practical-java-python-collections.svg '괄호 모양이 자료구조를 구분한다')

| 자료구조 | 표기        | 순서           | 변경 | 중복      | 주요 연산                                   |
| -------- | ----------- | -------------- | ---- | --------- | ------------------------------------------- |
| 리스트   | `[1, 2, 3]` | 있음           | 가능 | 허용      | `append`, `insert`, `pop`, `remove`, `sort` |
| 튜플     | `(1, 2, 3)` | 있음           | 불가 | 허용      | 인덱싱, 슬라이싱, 언패킹                    |
| 딕셔너리 | `{"k": 1}`  | 입력 순서 유지 | 가능 | 키는 불가 | `d[k]`, `get`, `keys`, `values`, `items`    |
| 세트     | `{1, 2, 3}` | 없음           | 가능 | 자동 제거 | `add`, `remove`, `&`, `\|`, `-`             |

```python
a = [1, 2, 3]
b = a
c = a[:]
b.append(4)
print(a, b, c)
print(a is b, a is c, a == c)

t = (10, 20, 30)
x, y, z = t
print(y, len(t), t + (40,))
one = (5,)
print(type(one).__name__, type((5)).__name__)

d = {"kim": 90, "lee": 75}
d["park"] = 85
d["kim"] = 95
print(d)
print(d.get("choi", 0), len(d), list(d.keys()))
for k, v in d.items():
    print(k, v)

s = {3, 1, 2, 3, 1}
s.add(5)
print(s, len(s))
print({1, 2, 3} & {2, 3, 4}, {1, 2, 3} | {2, 3, 4}, {1, 2, 3} - {2, 3, 4})
```

```text
[1, 2, 3, 4] [1, 2, 3, 4] [1, 2, 3]
True False False
20 3 (10, 20, 30, 40)
tuple int
{'kim': 95, 'lee': 75, 'park': 85}
0 3 ['kim', 'lee', 'park']
kim 95
lee 75
park 85
{1, 2, 3, 5} 4
{2, 3} {1, 2, 3, 4} {1}
```

![변수 a와 b는 리스트 객체 #1(1, 2, 3, 4)을 함께 가리키고, c는 슬라이스로 만든 리스트 객체 #2(1, 2, 3)를 가리키는 도식. b.append(4)로 추가된 4를 주황으로 강조했다](./images/eip-practical-java-python-list-alias.svg 'b = a는 같은 리스트에 이름을 하나 더 붙이는 것이다')

줄마다 확인할 내용은 다음과 같다.

- Python의 변수도 Java의 참조 변수처럼 객체를 가리키는 이름표다. `b = a` 이후 `b.append(4)`는 a가 가리키는 리스트를 바꾼다. `a[:]`는 전체를 잘라 낸 새 리스트라서 c는 영향을 받지 않는다.
- `is`는 같은 객체인지(Java의 `==`), `==`는 내용이 같은지(Java의 `equals`) 비교한다. a는 이제 `[1, 2, 3, 4]`이고 c는 `[1, 2, 3]`이라 `a == c`도 False다.
- 원소가 하나인 튜플은 `(5,)`처럼 쉼표를 붙여야 한다. `(5)`는 괄호로 감싼 정수 5다.
- `x, y, z = t`처럼 여러 변수에 한 번에 나눠 담는 것을 언패킹(unpacking)이라고 한다.
- 딕셔너리에 없는 키를 `d["choi"]`로 읽으면 `KeyError`가 발생하지만, `d.get("choi", 0)`은 기본값 0을 돌려준다. 이미 있는 키에 대입하면 값만 바뀌고 순서는 그대로다.
- 세트는 중복을 제거한다. `{3, 1, 2, 3, 1}`은 원소 3개가 된다. 세트의 출력 순서는 언어가 보장하지 않으므로 시험 문제는 보통 `len()`이나 정렬한 결과를 묻는다. 작은 정수는 실제로 오름차순으로 출력되는 경우가 많다.
- `&`는 교집합, `|`는 합집합, `-`는 차집합이다.

## Python: 슬라이싱과 range

### 인덱스와 슬라이싱

문자열, 리스트, 튜플처럼 순서가 있는 자료형은 인덱스(index)로 원소 하나를 꺼낸다. 앞에서부터는 0, 1, 2…로, 뒤에서부터는 -1, -2, -3…으로 번호를 매긴다. `s[-1]`은 마지막 원소다.

슬라이싱(slicing)은 `s[start:stop:step]` 형식으로 일부를 잘라 새 객체를 만든다. 규칙은 세 가지다.

1. ==start는 포함하고 stop은 포함하지 않는다.== `s[2:5]`는 인덱스 2, 3, 4다.
2. 생략하면 start는 처음, stop은 끝, step은 1이다. step이 음수이면 start의 기본값은 끝, stop의 기본값은 처음 앞이다.
3. 범위를 벗어난 인덱스를 써도 오류 없이 있는 만큼만(없으면 빈 값) 잘라 낸다. 인덱싱 `s[10]`은 `IndexError`지만 슬라이싱 `s[10:]`은 빈 문자열이다.

![문자열 PYTHON의 글자 칸 위에 양수 인덱스 0~5, 아래에 음수 인덱스 -6~-1을 적고, 그 아래에 글자 사이를 가리키는 슬라이스 경계 0~6을 그린 뒤 s[2:5]가 경계 2와 5 사이의 THO를 고르는 모습을 표시한 도식](./images/eip-practical-java-python-slicing-index.svg '슬라이스 숫자를 글자 사이의 칸막이로 생각하면 stop 제외 규칙이 자연스럽다')

```python
s = "PYTHON"
print(s[0], s[-1], s[2:5], s[:3], s[3:])
print(s[-3:], s[:-2], s[::2], s[1::2])
print(s[::-1], s[4:1:-1], s[-1:-4:-1])
print(s[10:], s[2:2], "[" + s[5:2] + "]")
L = [0, 10, 20, 30, 40, 50, 60]
print(L[1:6:2], L[-2:], L[::-3])
L[1:3] = [1]
print(L)
```

```text
P N THO PYT HON
HON PYTH PTO YHN
NOHTYP OHT NOH
  []
[10, 30, 50] [50, 60] [60, 30, 0]
[0, 1, 30, 40, 50, 60]
```

![PYTHON 글자 칸 세 줄에서 s[::2]는 P, T, O를 파랑으로, s[1::2]는 Y, H, N을 초록으로, s[::-1]은 N부터 P까지 모두 빨강으로 칠하고 고르는 순서를 곡선 화살표로 그린 도식](./images/eip-practical-java-python-slicing-step.svg 'step은 건너뛰는 간격이고, 음수면 방향이 뒤집힌다')

| 식            | 고르는 인덱스                | 결과          |
| ------------- | ---------------------------- | ------------- |
| `s[2:5]`      | 2, 3, 4                      | `THO`         |
| `s[-3:]`      | -3, -2, -1 (3, 4, 5)         | `HON`         |
| `s[:-2]`      | 0 ~ 3                        | `PYTH`        |
| `s[::2]`      | 0, 2, 4                      | `PTO`         |
| `s[::-1]`     | 5, 4, 3, 2, 1, 0             | `NOHTYP`      |
| `s[4:1:-1]`   | 4, 3, 2 (1은 제외)           | `OHT`         |
| `s[-1:-4:-1]` | -1, -2, -3                   | `NOH`         |
| `s[5:2]`      | step이 양수인데 start > stop | 빈 문자열     |
| `L[::-3]`     | 6, 3, 0                      | `[60, 30, 0]` |

넷째 줄 출력은 공백 두 칸 뒤에 `[]`다. `print`는 인자 사이에 공백을 하나씩 넣는데, 앞의 두 인자가 빈 문자열이라 공백만 두 개 남았다. 출력값 문제에서 이런 공백을 빠뜨리지 않도록 주의한다.

마지막 `L[1:3] = [1]`은 슬라이스에 대입하는 문법이다. 인덱스 1, 2의 원소 두 개(10, 20)가 원소 하나(1)로 바뀌어 리스트 길이가 7에서 6으로 줄었다.

### range

`range(start, stop, step)`은 정수의 범위를 만든다. 슬라이싱과 같이 ==stop은 포함하지 않는다==. 인자가 하나면 0부터 시작하고, step이 음수이면 거꾸로 진행한다. range는 값을 미리 다 만들지 않는 객체라서, 내용을 확인하려면 `list()`로 감싸야 한다.

```python
print(list(range(5)))
print(list(range(2, 10, 3)))
print(list(range(10, 0, -3)))
print(list(range(5, 1)))
total = 0
for i in range(1, 11, 2):
    total += i
print(total)
```

```text
[0, 1, 2, 3, 4]
[2, 5, 8]
[10, 7, 4, 1]
[]
25
```

| 반복 | i   | total |
| ---- | --- | ----- |
| 1    | 1   | 1     |
| 2    | 3   | 4     |
| 3    | 5   | 9     |
| 4    | 7   | 16    |
| 5    | 9   | 25    |

`range(1, 11, 2)`는 11을 포함하지 않으므로 9에서 끝난다. `range(5, 1)`은 step이 기본값 1인데 5에서 1로 올라갈 수 없으므로 비어 있다.

## Python: 컴프리헨션

리스트 컴프리헨션(list comprehension)은 반복문으로 리스트를 만드는 코드를 한 줄로 쓰는 문법이다. `[식 for 변수 in 반복가능객체 if 조건]` 형식이고, 조건을 통과한 원소마다 식을 계산해 새 리스트에 담는다. 대괄호 대신 중괄호를 쓰면 딕셔너리(`{키: 값 for …}`)나 세트(`{식 for …}`) 컴프리헨션이 된다.

```python
nums = [1, 2, 3, 4, 5, 6]
print([n * n for n in nums])
print([n for n in nums if n % 2 == 0])
print([n if n % 2 else 0 for n in nums])
print([(i, j) for i in range(1, 3) for j in range(i)])
print({n: n * 10 for n in range(3)})
print({len(w) for w in ["a", "bb", "cc", "ddd"]})
m = [[i * 3 + j for j in range(3)] for i in range(2)]
print(m)
print(sum([n for n in range(10) if n % 3 == 0]))
```

```text
[1, 4, 9, 16, 25, 36]
[2, 4, 6]
[1, 0, 3, 0, 5, 0]
[(1, 0), (2, 0), (2, 1)]
{0: 0, 1: 10, 2: 20}
{1, 2, 3}
[[0, 1, 2], [3, 4, 5]]
18
```

컴프리헨션은 같은 일을 하는 반복문으로 풀어 쓰면 읽기 쉽다. 두 번째 줄은 아래 코드와 같다.

```python
result = []
for n in nums:
    if n % 2 == 0:
        result.append(n)
```

| 표현                               | 뜻                                         | 결과 원소 수   |
| ---------------------------------- | ------------------------------------------ | -------------- |
| `[n for n in nums if 조건]`        | 뒤의 `if`는 거르기(필터)                   | 줄어들 수 있음 |
| `[a if 조건 else b for n in nums]` | 앞의 `if-else`는 값 고르기(조건 표현식)    | 원래와 같음    |
| `[… for i in A for j in B]`        | 앞의 for가 바깥 반복, 뒤의 for가 안쪽 반복 | A × B          |

세 번째 줄 `n if n % 2 else 0`에서 `n % 2`는 홀수면 1(참), 짝수면 0(거짓)이다. 홀수는 그대로, 짝수는 0으로 바뀐다. 네 번째 줄의 이중 for는 다음 순서로 진행한다.

| i   | range(i) | 만들어지는 튜플 |
| --- | -------- | --------------- |
| 1   | 0        | (1, 0)          |
| 2   | 0, 1     | (2, 0), (2, 1)  |

마지막 줄은 0부터 9까지 3의 배수(0, 3, 6, 9)를 골라 합한 18이다.

## Python: 문자열 메서드

Python의 문자열은 변경할 수 없는(immutable) 객체라서, `upper()`나 `replace()` 같은 메서드는 원본을 바꾸지 않고 새 문자열을 돌려준다. 시험에 자주 나오는 메서드는 다음과 같다.

| 메서드               | 동작                                      | 예 (`s = "Hello World Python"`)        |
| -------------------- | ----------------------------------------- | -------------------------------------- |
| `split(sep)`         | sep으로 나눠 리스트로(생략하면 공백 기준) | `['Hello', 'World', 'Python']`         |
| `sep.join(리스트)`   | 리스트의 문자열을 sep으로 이어 붙임       | `"-".join(...)` → `Hello-World-Python` |
| `upper()`, `lower()` | 대문자, 소문자로                          | `HELLO WORLD PYTHON`                   |
| `find(x, start)`     | x가 처음 나오는 인덱스, 없으면 -1         | `s.find("o")` → 4                      |
| `index(x)`           | find와 같지만 없으면 `ValueError`         | `s.index("W")` → 6                     |
| `count(x)`           | x가 나오는 횟수                           | `s.count("o")` → 3                     |
| `replace(a, b, n)`   | a를 b로 앞에서부터 n개 바꿈               | `Hell0 W0rld Python`                   |
| `strip()`            | 양 끝 공백 제거                           | `"  pad  ".strip()` → `pad`            |
| `startswith(x)`      | x로 시작하는지                            | True                                   |

```python
s = "Hello World Python"
words = s.split()
print(words, len(words))
print("-".join(words))
print(s.upper(), s.lower())
print(s.find("o"), s.find("o", 5), s.find("z"), s.index("W"))
print(s.count("o"), s.replace("o", "0", 2))
print("a,b,,c".split(","))
print("  pad  ".strip() + "|", s.startswith("He"), s[::-1][:6])
print("%d-%s-%.2f" % (3, "x", 1.5), f"{7:03d}", "{}+{}".format(1, 2))
print("abc" * 3, "b" in "abc", ord("A"), chr(97))
```

```text
['Hello', 'World', 'Python'] 3
Hello-World-Python
HELLO WORLD PYTHON hello world python
4 7 -1 6
3 Hell0 W0rld Python
['a', 'b', '', 'c']
pad| True nohtyP
3-x-1.50 007 1+2
abcabcabc True 65 a
```

확인할 점을 정리하면 다음과 같다.

- `s.find("o", 5)`는 인덱스 5부터 찾는다. 5는 공백, 6은 W, 7이 o라서 7이다.
- `"a,b,,c".split(",")`처럼 구분자가 연달아 있으면 그 사이에 빈 문자열 `''`이 생긴다. 인자 없는 `split()`은 연속된 공백을 하나로 취급해서 빈 문자열이 생기지 않는다.
- `s[::-1][:6]`은 뒤집은 문자열 `"nohtyP dlroW olleH"`의 앞 6글자다.
- 서식 문자열은 세 방식이 있다. `%` 방식은 C의 printf와 같은 서식 지정자를, f-string은 `{값:서식}`을, `format()`은 `{}` 자리에 인자를 차례로 넣는다. `{7:03d}`는 폭 3칸을 0으로 채운 정수 `007`이다.
- 문자열에 정수를 곱하면 반복된다. `ord`는 문자를 코드로, `chr`는 코드를 문자로 바꾼다.

## Python: 함수

### 기본 인자, 키워드 인자, 가변 인자

함수는 `def`로 정의한다. 매개변수에 `=값`을 붙이면 호출할 때 생략할 수 있는 기본 인자(default argument)가 된다. 호출할 때 `이름=값`으로 넘기면 순서와 상관없이 해당 매개변수에 들어가는데, 이를 키워드 인자라고 한다. 매개변수 앞에 `*`를 붙이면 넘긴 인자를 모두 튜플로 받는 가변 인자가 된다.

```python
def power(base, exp=2):
    return base ** exp

print(power(3), power(2, 5), power(exp=3, base=2))

def add_item(item, box=[]):
    box.append(item)
    return box

print(add_item(1))
print(add_item(2))
print(add_item(3, []))

def stats(*args):
    return min(args), max(args), sum(args) / len(args)

lo, hi, avg = stats(4, 8, 6)
print(lo, hi, avg)

x = 10
def change():
    x = 20
    return x

def change_global():
    global x
    x = 30

print(change(), x)
change_global()
print(x)
print(7 // 2, -7 // 2, 7 % 3, -7 % 3, 7 / 2, 2 ** 10)
```

```text
9 32 8
[1]
[1, 2]
[3]
4 8 6.0
20 10
30
3 -4 1 2 3.5 1024
```

| 줄              | 설명                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `9 32 8`        | `power(3)`은 exp 기본값 2로 3², `power(exp=3, base=2)`는 키워드 인자로 2³                                                   |
| `[1]`, `[1, 2]` | 기본값 `[]`는 ==함수를 정의하는 시각에 한 번만== 만들어져 호출 사이에 공유된다. 두 번째 호출에서 같은 리스트에 2가 추가된다 |
| `[3]`           | 리스트를 직접 넘기면 기본값을 쓰지 않는다                                                                                   |
| `4 8 6.0`       | 함수가 값 3개를 튜플로 돌려주고 언패킹. `/`는 항상 실수 나눗셈이라 6.0                                                      |
| `20 10`         | 함수 안에서 대입한 x는 새 지역 변수. 바깥 x는 그대로 10                                                                     |
| `30`            | `global x` 선언 뒤의 대입은 전역 변수를 바꾼다                                                                              |

> [!WARNING] 기본 인자에 리스트·딕셔너리를 쓰지 않는다
>
> 변경 가능한 객체를 기본 인자로 쓰면 위처럼 호출할 때마다 값이 누적된다. 실무에서는 `def add_item(item, box=None):`으로 쓰고 함수 안에서 `if box is None: box = []`로 새 리스트를 만든다. 시험에서는 이 누적 동작을 아는지 묻는 문제로 나온다.

### 나눗셈 연산자: C·Java와 다른 점

마지막 줄은 Python의 나눗셈 연산자를 보여 준다. Python에는 나눗셈 연산자가 두 개 있다. `/`는 정수끼리여도 항상 실수 결과를, `//`는 몫을 낸다. 그리고 `//`는 0 쪽이 아니라 ==음의 무한대 쪽으로 내림(floor)==한다. 나머지 `%`는 `(a // b) * b + a % b == a`가 성립하도록 정해지므로, 결과 부호가 ==나누는 수(오른쪽)의 부호==를 따른다.

| 식        | C·Java               | Python    |
| --------- | -------------------- | --------- |
| `7 / 2`   | 3 (정수 나눗셈)      | 3.5       |
| `7 // 2`  | 해당 없음            | 3         |
| `-7 / 2`  | -3 (0 쪽으로 버림)   | -3.5      |
| `-7 // 2` | 해당 없음            | -4 (내림) |
| `-7 % 3`  | -1                   | 2         |
| `2 ** 10` | 해당 없음(`**` 없음) | 1024      |

같은 `-7 % 3`이 C에서는 -1, Python에서는 2다. 세 언어가 한 시험에 섞여 나오므로 언어마다 규칙을 구분해 기억한다.

### lambda, map, filter, sorted

lambda는 이름 없는 한 줄짜리 함수를 만드는 식이다. `lambda 매개변수: 식` 형식이고, 식의 값이 반환값이 된다. 주로 다른 함수에 함수를 인자로 넘길 때 쓴다.

| 함수                             | 동작                                        | 반환                |
| -------------------------------- | ------------------------------------------- | ------------------- |
| `map(함수, 반복가능객체)`        | 모든 원소에 함수를 적용                     | map 객체(지연 계산) |
| `filter(함수, 반복가능객체)`     | 함수가 참을 돌려준 원소만 남김              | filter 객체         |
| `sorted(반복가능객체, key=함수)` | key 함수의 결과를 기준으로 정렬한 새 리스트 | 리스트              |

```python
sq = lambda x: x * x
print(sq(4))
nums = [3, 8, 1, 6, 5]
print(list(map(lambda x: x * 2, nums)))
print(list(filter(lambda x: x > 4, nums)))
print(list(map(str, nums)))
print(sorted(nums, key=lambda x: -x))
words = ["kiwi", "fig", "banana", "apple"]
print(sorted(words, key=len), sorted(words, key=lambda w: w[-1]))
print(list(map(lambda a, b: a + b, [1, 2, 3], [10, 20, 30])))
print(sum(map(lambda x: x % 3, range(7))))
```

```text
16
[6, 16, 2, 12, 10]
[8, 6, 5]
['3', '8', '1', '6', '5']
[8, 6, 5, 3, 1]
['fig', 'kiwi', 'apple', 'banana'] ['banana', 'apple', 'fig', 'kiwi']
[11, 22, 33]
6
```

![nums [3, 8, 1, 6, 5]의 각 원소가 map(x * 2)로 6, 16, 2, 12, 10이 되고, filter(x > 4)에서 3과 1이 빨간 선으로 지워져 8, 6, 5만 남는 모습을 칸 그림으로 그린 도식](./images/eip-practical-java-python-map-filter.svg 'map은 개수가 그대로, filter는 줄어든다')

- `map`과 `filter`의 결과는 리스트가 아니라 필요할 때 값을 하나씩 만드는 객체다. `print(map(...))`를 하면 `<map object at 0x…>`가 출력되므로, 문제 코드에 `list()`가 있는지 확인한다.
- `sorted(nums, key=lambda x: -x)`는 부호를 뒤집은 값으로 오름차순 정렬하므로 결과는 내림차순이다. `sorted(nums, reverse=True)`와 같다.
- `sorted(words, key=lambda w: w[-1])`은 마지막 글자(i, g, a, e) 기준이라 a, e, g, i 순서인 banana, apple, fig, kiwi다.
- `map`에 리스트 두 개를 넘기면 같은 위치의 원소를 짝지어 함수에 넘긴다.
- 마지막 줄은 0~6을 3으로 나눈 나머지 0, 1, 2, 0, 1, 2, 0의 합 6이다.

## Python: 클래스와 self

Python 클래스의 메서드는 첫 번째 매개변수로 객체 자신을 받는다. 관례상 이름을 `self`라고 쓰고, Java의 `this`에 해당한다. `a.deposit(500)`을 호출하면 Python이 `Account.deposit(a, 500)`으로 바꿔 실행하므로 self에 a가 들어간다. 생성자 역할은 `__init__` 메서드가 한다.

클래스 블록 안에 바로 쓴 변수는 클래스 속성(class attribute)으로 모든 객체가 공유하고(Java의 static 필드), `self.이름`에 대입한 변수는 인스턴스 속성으로 객체마다 따로 있다. `self.rate`처럼 속성을 읽으면 ==인스턴스 → 클래스 → 부모 클래스== 순서로 찾는다.

```python
class Account:
    rate = 0.1
    count = 0

    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance
        Account.count += 1

    def deposit(self, amount):
        self.balance += amount
        return self

    def interest(self):
        return int(self.balance * self.rate)

    def __str__(self):
        return f"{self.owner}:{self.balance}"


class Saving(Account):
    rate = 0.2

    def deposit(self, amount):
        super().deposit(amount + 100)
        return self


a = Account("kim", 1000)
b = Saving("lee")
a.deposit(500)
b.deposit(400).deposit(0)
print(a, b, Account.count)
print(a.interest(), b.interest())
a.rate = 0.5
print(a.interest(), Account.rate, b.rate)
c = a
c.deposit(1)
print(a.balance)
```

```text
kim:1500 lee:600 2
150 120
750 0.1 0.2
1501
```

| 실행 문장                  | a.balance | b.balance | Account.count | 설명                                                        |
| -------------------------- | --------- | --------- | ------------- | ----------------------------------------------------------- |
| `a = Account("kim", 1000)` | 1000      |           | 1             | `__init__` 실행                                             |
| `b = Saving("lee")`        | 1000      | 0         | 2             | Saving에 `__init__`이 없어 부모 것을 사용, balance 기본값 0 |
| `a.deposit(500)`           | 1500      | 0         | 2             | Account의 deposit                                           |
| `b.deposit(400)`           | 1500      | 500       | 2             | Saving의 deposit이 400 + 100을 부모 deposit에 넘김          |
| `.deposit(0)`              | 1500      | 600       | 2             | `return self`라 이어서 호출 가능, 0 + 100                   |
| `c = a; c.deposit(1)`      | 1501      | 600       | 2             | c와 a는 같은 객체                                           |

![Account 클래스(rate = 0.1, count = 2)와 이를 상속한 Saving 클래스(rate = 0.2), a 인스턴스(rate=0.5를 직접 가짐)와 b 인스턴스를 그리고, a.rate는 인스턴스에서 바로 찾고 b.rate는 Saving 클래스의 0.2를 찾는 조회 경로를 화살표로 표시한 도식](./images/eip-practical-java-python-class-attr.svg '읽기는 위로 올라가며 찾지만, 대입은 그 객체에 새 속성을 만든다')

이자 계산 부분이 이 예제의 함정이다.

1. `a.interest()`는 `self.rate`를 a에서 찾는다. a에는 rate가 없으므로 Account의 0.1을 써서 `int(1500 × 0.1)` = 150이다.
2. `b.interest()`는 b에 rate가 없으므로 Saving에서 찾아 0.2를 쓴다. `int(600 × 0.2)` = 120이다. 부모 클래스(Account)에 정의된 메서드 안이어도 self가 b이므로 Saving의 rate가 먼저 발견된다. Java의 동적 바인딩과 같은 원리다.
3. `a.rate = 0.5`는 클래스 속성을 바꾸지 않고 ==a에만 rate라는 인스턴스 속성을 새로 만든다==. 이후 a에서는 0.5를 쓰고(`int(1500 × 0.5)` = 750), Account.rate와 b.rate는 그대로다.

`__str__`은 `print(a)`처럼 객체를 문자열로 바꿔야 할 때 호출되는 특수 메서드다. 정의하지 않으면 `<__main__.Account object at 0x…>` 같은 기본 표현이 출력된다. `super().deposit(...)`은 부모 클래스의 메서드를 호출하며, Java의 `super.deposit(...)`과 같은 역할이다.

## 출력값 문제를 풀 때 자주 틀리는 곳

| 언어   | 함정                                      | 바른 결과                             |
| ------ | ----------------------------------------- | ------------------------------------- |
| Java   | 부모 타입 변수로 오버라이딩된 메서드 호출 | 실제 객체(자식)의 메서드 실행         |
| Java   | 부모 타입 변수로 같은 이름 필드 접근      | 변수 타입(부모)의 필드                |
| Java   | 자식 생성자 실행                          | 부모 생성자 본문이 먼저 출력          |
| Java   | `"A" + 1 + 2`                             | `A12`                                 |
| Java   | `new String("x") == "x"`                  | false                                 |
| Java   | try 안의 return과 finally                 | finally 출력 후 반환                  |
| Java   | double 반환 메서드가 정수 계산            | `6.0`처럼 소수점이 붙음               |
| Python | `b = a` 후 `b.append(…)`                  | a도 바뀜                              |
| Python | `s[2:5]`                                  | 인덱스 5는 제외                       |
| Python | `range(1, 10)`                            | 10은 제외                             |
| Python | `-7 // 2`, `-7 % 3`                       | -4, 2                                 |
| Python | 기본 인자 `box=[]`                        | 호출 사이에 누적                      |
| Python | `a.rate = 값`                             | a에만 새 속성, 클래스 속성은 그대로   |
| Python | `print(map(...))`                         | map 객체 표현이 출력됨, `list()` 필요 |

## 관련 글

- [정보처리기사 실기 C 코드 읽기](/memo/eip-practical-c): 서식 지정자, 연산자 우선순위, 포인터, 재귀, 구조체를 같은 방식의 추적 표로 다룬다
- [정보처리기사 실기 시험 구조와 답안 작성](/memo/eip-practical-overview): 실기 시험의 문항 구성과 답안 작성 요령
- [정보처리기사 실기 요구사항·설계·UML·디자인 패턴·테스트](/memo/eip-practical-design-test): 이 글의 상속·인터페이스 개념이 이어지는 객체 지향 설계와 디자인 패턴
- [컴퓨터와 정보보호 개론: 프로그래밍 언어](/memo/csintro-programming-languages): 컴파일러와 인터프리터, 객체 지향 패러다임의 배경

<details>
<summary>참고 문헌</summary>

- 한국산업인력공단, 정보처리기사 실기 출제기준(현행, 적용 기간 2023.1.1~2025.12.31), Q-Net
- James Gosling 외, The Java Language Specification, Java SE 25 Edition, Oracle. 8.8 Constructor Declarations, 8.4.8 Inheritance, Overriding, and Hiding, 15.12 Method Invocation Expressions, 14.20 The try statement, 3.10.5 String Literals
- Oracle, The Java Tutorials: Inheritance, Interfaces, Exceptions, https://docs.oracle.com/javase/tutorial/java/
- Python Software Foundation, The Python Tutorial 3장(문자열과 리스트 슬라이싱), 5장(자료구조와 컴프리헨션), 9장(클래스), https://docs.python.org/3/tutorial/
- Python Software Foundation, The Python Language Reference 6.7 Binary arithmetic operations(`//`와 `%`의 정의), https://docs.python.org/3/reference/expressions.html
- Python Software Foundation, Built-in Types: str 메서드, range, set, https://docs.python.org/3/library/stdtypes.html

</details>

#정보처리기사 #자격증 #실기 #Java #Python #객체지향
