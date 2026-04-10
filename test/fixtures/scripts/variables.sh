#!/bin/sh
# 变量和条件测试

NAME="World"
COUNT=5

echo "Hello, $NAME!"
echo "Count is: $COUNT"

if [ "$COUNT" -gt 3 ]; then
    echo "Count is greater than 3"
else
    echo "Count is 3 or less"
fi

# 循环测试
echo "Loop test:"
for i in 1 2 3; do
    echo "  Item: $i"
done
