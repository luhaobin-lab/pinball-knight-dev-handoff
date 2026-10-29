# UMG默认值：当前二进制初始化链补充

本次仅检查Build25684533当前Shipping EXE，SHA256为 `ccd1db79c2eb3668242c4c10d271234963bc9dc1efa3ec0afddace444d1afcab`。没有启动或加载原游戏，没有执行原对象/世界函数，也没有修改已发布R3数据。

## 新证据

此前只定位到UUniformGridSlot原生构造器没有写Row/Column，不能据一般UE知识把未序列化字段填0。本次从实际反射入口追到了新的二进制调用链：

```text
PanelWidget.AddChild / UniformGridPanel.AddChildToUniformGrid
    -> 0x141385200 包装器
    -> 0x141503f30 对象构造控制流
       -> 0x1415033e0 对象分配控制流
          -> 0x141503be9 调用memset
       -> 0x1415041da 调用Class+0xb0的构造函数指针
       -> 0x1414e9340 初始化器析构
          -> 0x1414faf10 后构造初始化
             -> 0x1414f7730 原型/默认属性拷贝
```

`0x141503be9`前的指令明确给出RCX=对象指针、EDX=0、R8=类的PropertiesSize。被调用的 `0x146a3a082` 跳转到IAT `0x146aed518`，实际导入为 `VCRUNTIME140.dll!memset`。该路径在非回收对象分支中执行，发生在构造函数指针调用之前。这里的清零已经有当前PE证据，不再仅依赖本机UE源码推测。

但是，**清零后仍存在默认值/原型拷贝及虚调用**。当前指令会选择原型或ClassDefaultObject，再调用属性初始化函数；字段拷贝还受DefaultClass大小检查。另一个CDO创建跳板 `0x1413f1150` 使用UClass虚表偏移 `+0x400`，对象后初始化还进入类虚表 `+0x3a8`。本次有界检查没有闭合这些虚目标和确切当前CDO内容。

因此仍不能把普通零初始化，直接等同于最终序列化模板里所有缺省Row/Column都是0。结果文件继续将 `inferredRowDefault` 和 `inferredColumnDefault` 留为null。

明确调用 `AddChildToUniformGrid` 的另一条事实是：当前函数在 `0x14348ae2b` 和 `0x14348ae49` 将输入InRow/InColumn写到对象 `+0x3c/+0x40`。这证明显式调用的赋值行为，不能替代未知的模板缺省值。

## 证据与边界

`evidence-manifest.json`保存15个当前PE字节范围和8条直接调用边。`native/`保存二进制和反汇编，`memset-import.json`保存实际导入解析。`verify_evidence.py`可只读重核当前PE与保存字节及相对调用目标。

部分函数采用链式pdata展开，单个`.pdata`区间只有入口片段。本次线性窗口明确标注为有界字节范围，不把短展开片段误称完整函数，也不把窗口中后续邻接函数的所有指令归到同一个函数。

本机UE5.7.4源码只用于函数命名与控制流线索，不被认证为该游戏完全相同的编译源码。本次止于三条新线索：反射入口到构造、分配清零、后构造默认拷贝。继续调查需要确切UClass虚表/DefaultObject链的新证据；不重复已失败的符号名搜索。

target：缩小UMG默认值证据缺口。proposals：无。needs：独立审核新调用链；最终默认值缺口保持未关闭。
