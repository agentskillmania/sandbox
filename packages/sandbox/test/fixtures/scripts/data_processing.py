#!/usr/bin/env python3
# 数据处理脚本（micropython 兼容）

def process_data(data):
    """处理输入数据"""
    return {
        'total': len(data),
        'sum': sum(data),
        'avg': sum(data) / len(data) if data else 0,
        'min': min(data) if data else 0,
        'max': max(data) if data else 0,
    }

def main():
    # 测试数据
    data = [1, 2, 3, 4, 5, 10, 20, 50, 100]

    # 处理数据
    result = process_data(data)

    # 输出结果（手动格式化，不使用 json.dumps indent）
    print("Statistics:")
    print(f"total: {result['total']}")
    print(f"sum: {result['sum']}")
    print(f"avg: {result['avg']:.2f}")
    print(f"min: {result['min']}")
    print(f"max: {result['max']}")

if __name__ == '__main__':
    main()
