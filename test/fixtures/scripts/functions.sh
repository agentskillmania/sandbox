#!/bin/sh
# 函数定义和调用测试

greet() {
    echo "Hello, $1!"
}

add() {
    echo $(($1 + $2))
}

# 调用函数
greet "World"
greet "Claude"

# 数学运算
result=$(add 10 20)
echo "10 + 20 = $result"

# 嵌套函数调用
echo "Nested: $(add 5 $(add 3 2))"
