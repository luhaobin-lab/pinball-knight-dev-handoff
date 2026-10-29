// CORE-M-TV-001…057, verbatim from D:/TAPTAPGAME_ref/spec-drafts/core-math.md §15 (extracted, not edited).
/* eslint-disable */
export interface Vector { id: string; given: any; when: string; then: any; source: string }
export const VECTORS: readonly Vector[] = [
 {
  "id": "CORE-M-TV-001",
  "given": {
   "x": {
    "c": 1500.0,
    "e": 0
   }
  },
  "when": "科学数标准化(x)",
  "then": {
   "result": {
    "c": 1.5,
    "e": 3
   }
  },
  "source": "函数库_科学数 L718-L737; CORE-M-010"
 },
 {
  "id": "CORE-M-TV-002",
  "given": {
   "a": {
    "c": 0.0,
    "e": 7
   },
   "b": {
    "c": 9.99999,
    "e": 0
   },
   "d": {
    "c": 1000.0,
    "e": 0
   }
  },
  "when": "科学数标准化 of a, b, d",
  "then": {
   "a": {
    "c": 0.0,
    "e": 0
   },
   "b": {
    "c": 0.9999990000000001,
    "e": 1
   },
   "d": {
    "c": 1.0,
    "e": 3
   }
  },
  "source": "函数库_科学数 L722-L734 (zero select; +1e-06 epsilon); CORE-M-010 QUIRK"
 },
 {
  "id": "CORE-M-TV-003",
  "given": {
   "A": {
    "c": 1.5,
    "e": 3
   },
   "B": {
    "c": 2.5,
    "e": 2
   }
  },
  "when": "科学数加减+-(A,B,加/减=false)",
  "then": {
   "result": {
    "c": 1.75,
    "e": 3
   }
  },
  "source": "函数库_科学数 L684-L715; CORE-M-011"
 },
 {
  "id": "CORE-M-TV-004",
  "given": {
   "A": {
    "c": 1.0,
    "e": 0
   },
   "B": {
    "c": 1.0,
    "e": 20
   },
   "Z": {
    "c": 0.0,
    "e": 0
   },
   "T": {
    "c": 5.0,
    "e": -20
   }
  },
  "when": "科学数加减+-(A,B,true) and 科学数加减+-(Z,T,false)",
  "then": {
   "A_minus_B": {
    "c": 1.0,
    "e": 20
   },
   "Z_plus_T": {
    "c": 0.0,
    "e": 0
   }
  },
  "source": "函数库_科学数 L697 (指数差值 > 15) L709; CORE-M-011 QUIRK"
 },
 {
  "id": "CORE-M-TV-005",
  "given": {
   "A": {
    "c": 2.0,
    "e": 3
   },
   "B": {
    "c": 5.0,
    "e": 4
   },
   "C": {
    "c": 3.0,
    "e": 2
   },
   "Z": {
    "c": 0.0,
    "e": 0
   },
   "One": {
    "c": 1.0,
    "e": 0
   },
   "Three": {
    "c": 3.0,
    "e": 0
   }
  },
  "when": "科学数乘除*/: A*B, C/Z, One/Three",
  "then": {
   "A_times_B": {
    "c": 1.0,
    "e": 8
   },
   "C_div_Z": {
    "c": 0.0,
    "e": 0
   },
   "One_div_Three": {
    "c": 3.333333333333333,
    "e": -1
   },
   "tol": 1e-12
  },
  "source": "函数库_科学数 L667-L681; Divide_DoubleDouble B==0 → 0 (exe 0x143b694c7); CORE-M-012"
 },
 {
  "id": "CORE-M-TV-006",
  "given": {
   "base1": {
    "c": 2.0,
    "e": 1
   },
   "exp1": 2.0,
   "base2": {
    "c": 1.0,
    "e": 3
   },
   "exp2": 0.5,
   "base3": {
    "c": 4.0,
    "e": -3
   },
   "exp3": 0.5,
   "base4": {
    "c": 2.0,
    "e": 3
   },
   "exp4": -1.0
  },
  "when": "科学数Power(base, exp)",
  "then": {
   "r1": {
    "c": 4.0,
    "e": 2
   },
   "r2": {
    "c": 3.1622776601683795,
    "e": 1
   },
   "r3": {
    "c": 6.324555320336758,
    "e": -2
   },
   "r4": {
    "c": 5.0,
    "e": -4
   },
   "tol": 1e-12
  },
  "source": "函数库_科学数 L8-L23; Fraction/FTrunc (exe 0x143b73080/0x143b715a0); CORE-M-013"
 },
 {
  "id": "CORE-M-TV-007",
  "given": {
   "A": {
    "c": -2.0,
    "e": 0
   },
   "B": {
    "c": -3.0,
    "e": 0
   }
  },
  "when": "比较科学数(A,B,false), 比较科学数(A,B,true), 科学数<(A,B), 科学数>(A,B), 科学数<({-2,1},{-3,0})",
  "then": {
   "max": {
    "结果": 1,
    "值": {
     "c": -2.0,
     "e": 0
    }
   },
   "min": {
    "结果": 1,
    "值": {
     "c": -3.0,
     "e": 0
    }
   },
   "lt": true,
   "gt": false,
   "lt_neg20_neg3": true
  },
  "source": "函数库_科学数 L323-L430 vs L196-L279 (bytecode-checked select wiring); CORE-M-016/017 QUIRK"
 },
 {
  "id": "CORE-M-TV-008",
  "given": {
   "X": {
    "c": 5.0,
    "e": 2
   },
   "Min": {
    "c": 1.0,
    "e": 1
   },
   "Max": {
    "c": 2.0,
    "e": 2
   },
   "Y": {
    "c": 5.0,
    "e": 0
   },
   "Min2": {
    "c": 3.0,
    "e": 0
   },
   "Max2": {
    "c": 1.0,
    "e": 0
   }
  },
  "when": "限制科学数(X,Min,Max) and 限制科学数(Y,Min2,Max2)",
  "then": {
   "clamp1": {
    "c": 2.0,
    "e": 2
   },
   "clamp2_min_gt_max": {
    "c": 3.0,
    "e": 0
   }
  },
  "source": "函数库_科学数 L42-L49; CORE-M-019"
 },
 {
  "id": "CORE-M-TV-009",
  "given": {
   "A": {
    "c": 0.0,
    "e": 0
   },
   "B": {
    "c": 5.0,
    "e": -1
   }
  },
  "when": "比较科学数（纯正）(A,B,取大=false) vs 比较科学数(A,B,false)",
  "then": {
   "pure_max": {
    "c": 0.0,
    "e": 0
   },
   "signed_max": {
    "c": 5.0,
    "e": -1
   }
  },
  "source": "函数库_科学数 L282-L320 vs L323-L430; CORE-M-018 QUIRK"
 },
 {
  "id": "CORE-M-TV-010",
  "given": {
   "x": {
    "c": -4.5,
    "e": 2
   }
  },
  "when": "科学数ABS(x), 科学数变普通(x), 科学数变普通({0,9})",
  "then": {
   "abs": {
    "c": 4.5,
    "e": 2
   },
   "toDouble": -450.0,
   "zero": 0.0
  },
  "source": "函数库_科学数 L52-L60, L574-L585; CORE-M-014/015"
 },
 {
  "id": "CORE-M-TV-011",
  "given": {
   "inputs": [
    {
     "x": {
      "c": 1.234,
      "e": 3
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 1.2345,
      "e": 4
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 1.23456,
      "e": 5
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 1.0,
      "e": 10
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 1.5,
      "e": 15
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 1.25,
      "e": 3
     },
     "小数位": 1
    },
    {
     "x": {
      "c": 1.0,
      "e": 3
     },
     "小数位": 0
    },
    {
     "x": {
      "c": 1.6,
      "e": 3
     },
     "小数位": 0
    }
   ]
  },
  "when": "科学数字缩写(x, 小数位).ReturnValue",
  "then": {
   "texts": [
    "1.23k",
    "12.3k",
    "123k",
    "10B",
    "1500T",
    "1.2k",
    "1k",
    "2k"
   ]
  },
  "source": "函数库_科学数 L433-L481; Conv_DoubleToText HalfToEven; CORE-M-041"
 },
 {
  "id": "CORE-M-TV-012",
  "given": {
   "inputs": [
    {
     "x": {
      "c": 2.5,
      "e": 0
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 3.5,
      "e": 0
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 1.25,
      "e": 1
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 9.9999,
      "e": 5
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 9.996,
      "e": 2
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 5.0,
      "e": -6
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 9.0,
      "e": -4
     },
     "小数位": 2
    },
    {
     "x": {
      "c": 1500.0,
      "e": 0
     },
     "小数位": 2
    }
   ]
  },
  "when": "科学数字缩写(x, 小数位).ReturnValue (edge cases)",
  "then": {
   "texts": [
    "2",
    "4",
    "12",
    "1000k",
    "1000",
    "5",
    "1",
    "1500"
   ],
   "notes": "half-to-even at 0 decimals; no unit carry after rounding; negative exponent shift by e%3; non-normalised input not re-normalised"
  },
  "source": "函数库_科学数 L436-L466; CORE-M-041 QUIRKs"
 },
 {
  "id": "CORE-M-TV-013",
  "given": {
   "inputs": [
    1500,
    2500,
    3500,
    999,
    999.5,
    1000,
    1000000.0,
    1000000000.0,
    1000000000000.0,
    0.5,
    0.6,
    0,
    -5
   ]
  },
  "when": "数字缩写(x).ReturnValue",
  "then": {
   "texts": [
    "2k",
    "2k",
    "4k",
    "999",
    "1000",
    "1k",
    "1M",
    "1B",
    "0",
    "0",
    "1",
    "0",
    "0"
   ]
  },
  "source": "函数库_工具 L699-L737; CORE-M-042"
 },
 {
  "id": "CORE-M-TV-014",
  "given": {
   "values": [
    0.15,
    0.05,
    0.225,
    18.5,
    0.0975,
    1.0
   ]
  },
  "when": "AsPercent_Float(v, HalfToEven, false, grouping=true, 1, 324, 0, 3)",
  "then": {
   "texts": [
    "15%",
    "5%",
    "22.5%",
    "1,850%",
    "9.75%",
    "100%"
   ]
  },
  "source": "函数库_工具 L1957 (args); CORE-M-043 (float32 ×100)"
 },
 {
  "id": "CORE-M-TV-015",
  "given": {
   "stat": "基础伤害",
   "计算类型": "加算",
   "来源映射": {
    "": {
     "c": 3.0,
     "e": 1
    },
    "a": {
     "c": 5.0,
     "e": 0
    },
    "b": {
     "c": -2.0,
     "e": 0
    }
   }
  },
  "when": "获取科学映射词条",
  "then": {
   "输出值": {
    "c": 3.3,
    "e": 1
   },
   "found": true
  },
  "source": "函数库_科学数 L516-L631; CORE-M-051"
 },
 {
  "id": "CORE-M-TV-016",
  "given": {
   "stat": "格挡减伤%",
   "计算类型": "乘算",
   "来源映射": {
    "": {
     "c": 1.5,
     "e": -1
    },
    "盾牌专精": {
     "c": 5.0,
     "e": -2
    }
   }
  },
  "when": "获取科学映射词条 then 科学数变普通",
  "then": {
   "输出值": {
    "c": 1.9250000000000012,
    "e": -1
   },
   "double": 0.19250000000000012,
   "meaning": "1-(1-0.15)(1-0.05)",
   "tol": 1e-12
  },
  "source": "函数库_科学数 L1055-L1670; 数据表_玩家 格挡减伤% 1.5×10^-1; 数据表_天赋_专属 盾牌专精 step 0.05; CORE-M-052"
 },
 {
  "id": "CORE-M-TV-017",
  "given": {
   "stat": "伤害减免%",
   "Vulnerable_stacks": 3,
   "易伤倍率%": 0.1,
   "case1": {
    "": 0,
    "<唯一ID>": -0.3
   },
   "case2": {
    "": 0,
    "<唯一ID>": -0.3,
    "x": 0.5
   }
  },
  "when": "蓝图_效果_易伤 writes -叠加层数×易伤倍率% into 伤害减免% (乘算), then 获取科学映射词条",
  "then": {
   "case1": -0.30000000000000004,
   "case2": 0.35,
   "tol": 1e-12
  },
  "source": "蓝图_效果_易伤 L66-L74; CORE-M-052/059"
 },
 {
  "id": "CORE-M-TV-018",
  "given": {
   "暴击率%": {
    "": 0,
    "item": 0.05,
    "talent": 0.05
   },
   "每格挡层": "entry with empty 来源映射",
   "missing": "不存在"
  },
  "when": "获取科学映射词条 for each",
  "then": {
   "暴击率%": 0.09750000000000036,
   "每格挡层": {
    "c": 0.0,
    "e": 0
   },
   "missing": {
    "输出值": {
     "c": 0.0,
     "e": 0
    },
    "found": false
   },
   "tol": 1e-12
  },
  "source": "函数库_科学数 L405, L516, L1055; CORE-M-052/053"
 },
 {
  "id": "CORE-M-TV-019",
  "given": {
   "来源映射": {
    "": 10,
    "永久保留": 4,
    "物品A/附魔": 3,
    "临时buff": 100
   }
  },
  "when": "科学映射原始值(map,'基础伤害',false/true) and 获取科学映射词条",
  "then": {
   "raw": {
    "c": 1.0,
    "e": 1
   },
   "raw_with_perm": {
    "c": 1.7,
    "e": 1
   },
   "aggregate": {
    "c": 1.17,
    "e": 2
   }
  },
  "source": "函数库_科学数 L519-L571 (Right(key,3)=='/附魔'; key '' from bytecode); CORE-M-056"
 },
 {
  "id": "CORE-M-TV-020",
  "given": {
   "map": {
    "护甲": {
     "计算类型": "加算",
     "来源映射": {
      "": {
       "c": 1.0,
       "e": 1
      }
     }
    }
   }
  },
  "when": "(a) 添加科学映射值(map,'护甲','a',{5,0},覆盖/修改=false) twice; (b) 添加科学映射值(map,'护甲','b',{5,0},true) twice; (c) 添加科学映射值(map,'治愈','a',{5,0},true); (d) 移除科学映射值(map,'闪避%','x')",
  "then": {
   "a": {
    "护甲.a": {
     "c": 5.0,
     "e": 0
    }
   },
   "b": {
    "护甲.b": {
     "c": 1.0,
     "e": 1
    }
   },
   "c": "no-op: '治愈' still absent",
   "d": {
    "returns": false,
    "map gains": {
     "闪避%": {
      "计算类型": "加算",
      "来源映射": {}
     }
    }
   }
  },
  "source": "函数库_科学数 L484-L516; CORE-M-054/055 QUIRK"
 },
 {
  "id": "CORE-M-TV-021",
  "given": {
   "生命": {
    "c": 1.5,
    "e": 2
   },
   "额外生命%": {
    "c": 2.0,
    "e": -1
   },
   "当前生命": {
    "c": 2.0,
    "e": 2
   }
  },
  "when": "BP_ManeActor.更新最大生命魔力",
  "then": {
   "最大生命[\"\"]": {
    "c": 1.5,
    "e": 2
   },
   "最大生命[\"额外生命词条\"]": {
    "c": 3.0,
    "e": 1
   },
   "当前最大生命": {
    "c": 1.8,
    "e": 2
   },
   "当前生命": {
    "c": 1.8,
    "e": 2
   },
   "生命百分比": 1.0
  },
  "source": "BP_ManeActor L2895-L2918; R2 text 543EE33F40E0EAF61D3903BC6468DB5D; CORE-M-060"
 },
 {
  "id": "CORE-M-TV-022",
  "given": {
   "item": "旧剑 (Old Sword, 8E521FDC4C4C09A8EEC41CA0536DCFE3)",
   "data": {
    "基础伤害": {
     "c": 2.0,
     "e": 1
    },
    "暴击率%": {
     "c": 0.0,
     "e": 0
    }
   },
   "hypothetical 格挡%": {
    "c": 1.0,
    "e": -1
   }
  },
  "when": "升级此牌 (等级 = trunc(2^(品质-1))) then 处理词条/成长词条",
  "then": {
   "by_quality": [
    {
     "品质": 1,
     "等级": 1,
     "基础伤害": {
      "c": 2.0,
      "e": 1
     },
     "暴击率%": {
      "c": 0.0,
      "e": 0
     },
     "格挡%": {
      "c": 1.0,
      "e": -1
     }
    },
    {
     "品质": 2,
     "等级": 2,
     "基础伤害": {
      "c": 4.0,
      "e": 1
     },
     "暴击率%": {
      "c": 0.0,
      "e": 0
     },
     "格挡%": {
      "c": 2.0,
      "e": -1
     }
    },
    {
     "品质": 3,
     "等级": 4,
     "基础伤害": {
      "c": 8.0,
      "e": 1
     },
     "暴击率%": {
      "c": 0.0,
      "e": 0
     },
     "格挡%": {
      "c": 4.0,
      "e": -1
     }
    },
    {
     "品质": 4,
     "等级": 8,
     "基础伤害": {
      "c": 1.6,
      "e": 2
     },
     "暴击率%": {
      "c": 0.0,
      "e": 0
     },
     "格挡%": {
      "c": 8.0,
      "e": -1
     }
    }
   ],
   "rule": "基础伤害/治愈/护甲 and stats absent from 数据表_词条_物品 ×等级; 暴击率% (成长？=0) unchanged"
  },
  "source": "BP_Actor_Card L621-L700, UG L33843; 数据表_修炼物品_通用 旧剑; 数据表_词条_物品 成长？; CORE-M-061/062"
 },
 {
  "id": "CORE-M-TV-023",
  "given": {
   "levels": [
    1,
    2,
    3,
    4,
    5,
    7,
    8,
    16
   ],
   "floors": [
    0,
    23,
    24,
    47,
    48,
    72
   ]
  },
  "when": "BP_ManeActor.添加技能 品质 = FTrunc(log_2(等级))+1; 获取层数品质(层数, 24)",
  "then": {
   "品质": [
    {
     "等级": 1,
     "品质": 1
    },
    {
     "等级": 2,
     "品质": 2
    },
    {
     "等级": 3,
     "品质": 2
    },
    {
     "等级": 4,
     "品质": 3
    },
    {
     "等级": 5,
     "品质": 3
    },
    {
     "等级": 7,
     "品质": 3
    },
    {
     "等级": 8,
     "品质": 4
    },
    {
     "等级": 16,
     "品质": 5
    }
   ],
   "层数品质": [
    1,
    1,
    2,
    2,
    3,
    4
   ]
  },
  "source": "BP_ManeActor L2014-L2018; 函数库_工具 L847-L854; UI_地图格 L539; CORE-M-062"
 },
 {
  "id": "CORE-M-TV-024",
  "given": {
   "param": {
    "初始值": 2.0,
    "提升值": 3.0,
    "词条": "基础伤害"
   },
   "等级": 5,
   "品质": 1,
   "上一次等级": [
    2,
    1
   ]
  },
  "when": "获取技能参数(序号, 上一级差值？=false) and (true) with 上一次等级 2 and 1",
  "then": {
   "normal": 17.0,
   "diff_last2": 9.0,
   "diff_last1": 17.0
  },
  "source": "函数库_技能 L670-L698; CORE-M-071"
 },
 {
  "id": "CORE-M-TV-025",
  "given": {
   "param": {
    "初始值": 0.0,
    "提升值": 0.15,
    "词条": "最大生命",
    "品质倍率？": true
   },
   "levels_quality": [
    [
     1,
     1
    ],
    [
     2,
     2
    ],
    [
     4,
     3
    ],
    [
     8,
     4
    ]
   ],
   "prefixes": [
    "Y基础伤害",
    "y基础伤害",
    "X暴击率%",
    "x暴击率%"
   ]
  },
  "when": "获取技能参数 参数值 per (等级, 品质); 词条 output for each prefix",
  "then": {
   "参数值": [
    0.15,
    0.3,
    0.44999999999999996,
    0.6
   ],
   "词条": [
    "基础伤害",
    "基础伤害",
    "暴击率%",
    "x暴击率%"
   ],
   "tol": 1e-12
  },
  "source": "函数库_技能 L680-L695 (StriStri 'Y', StrStr 'X'); 数据表_技能_修炼物品 治愈等于生命上限; CORE-M-071/072"
 },
 {
  "id": "CORE-M-TV-026",
  "given": {
   "talent": "生命成长 Life Growth",
   "param0": {
    "词条": "额外生命%",
    "初始值": 0.0,
    "提升值": 0.05,
    "不预算？": true
   },
   "等级": 2
  },
  "when": "根据参数生成文本(param0, ability, 2); 更新技能描述 with 原始描述 '每装备一个<强调>治愈</>物品，提升{0}生命上限。'",
  "then": {
   "param_text": " <天赋>10%</> ",
   "描述": "每装备一个<强调>治愈</>物品，提升 <天赋>10%</> 生命上限。"
  },
  "source": "数据表_天赋_新新通用 生命成长; 函数库_工具 L1922-L1984; capture tut07/f130 'Life Growth Level 2/8 … by 10% .'"
 },
 {
  "id": "CORE-M-TV-027",
  "given": {
   "talent": "上肢力量 Upper Limb Strength",
   "param0": {
    "词条": "基础伤害",
    "初始值": 0.0,
    "提升值": 6.0,
    "不预算？": true,
    "整数？": true
   },
   "等级": 1
  },
  "when": "根据参数生成文本(param0, ability, 1)",
  "then": {
   "param_text": " <天赋>6</> "
  },
  "source": "数据表_天赋_新新通用 上肢力量; capture tut07/f130 '… increased by 6 .'"
 },
 {
  "id": "CORE-M-TV-028",
  "given": {
   "talent": "浴血奋战 Bloodied Resolve",
   "params": [
    {
     "词条": "基础伤害",
     "初始值": 0.0,
     "提升值": 0.1,
     "不预算？": true
    },
    {
     "词条": "",
     "初始值": 3.0,
     "整数？": true
    },
    {
     "词条": "",
     "提升值": 8.0,
     "整数？": true
    }
   ],
   "等级": 2
  },
  "when": "更新技能描述 for 原始描述 '每{1}次反弹时受到{2}伤害，并增加{0}英雄基础伤害，直到战斗结束。'",
  "then": {
   "args": {
    "0": " <天赋>20%</> ",
    "1": " <天赋>3</> ",
    "2": " <天赋>16</> "
   },
   "描述": "每 <天赋>3</> 次反弹时受到 <天赋>16</> 伤害，并增加 <天赋>20%</> 英雄基础伤害，直到战斗结束。",
   "capture_flag": "video tut07/f130 shows {1}=3 {2}=16 but {0}=4 (older build): data wins"
  },
  "source": "数据表_天赋_专属 浴血奋战 (desc key E3AA779C4E82294FE22CA382A6C8A64D); CORE-M-088"
 },
 {
  "id": "CORE-M-TV-029",
  "given": {
   "owner": "眼球 Eyeball Bug",
   "owner 治愈": {
    "c": 2.5,
    "e": 1
   },
   "skill": "自愈",
   "param0": {
    "词条": "治愈",
    "初始值": 1.0
   }
  },
  "when": "更新技能描述 for '治愈{0}。' / 'Heal {0}.'",
  "then": {
   "param_text": " <天赋>25</> ",
   "纯数值文本": "100%",
   "zh": "治愈 <天赋>25</> 。",
   "en": "Heal  <天赋>25</> ."
  },
  "source": "数据表_敌人_普通 眼球; 数据表_技能_默认 自愈; capture intent_tooltip.json (tut03-2/f030) 'Heal 25 .'"
 },
 {
  "id": "CORE-M-TV-030",
  "given": {
   "items": {
    "生命药剂_新手关": {
     "治愈": {
      "c": 2.0,
      "e": 1
     },
     "品质": 1
    },
    "旧长袍": {
     "经验": {
      "c": 2.0,
      "e": 0
     },
     "品质": 1
    }
   }
  },
  "when": "render 使用恢复生命[0] (治愈 ×1.0) on 生命药剂_新手关; 蓄能获得光阴[0] (经验 ×1.0) and 旧长袍[0] (0+20·lvlQ, 不预算 整数 品质倍率), 旧长袍[1] (4, 不预算 整数) on 旧长袍",
  "then": {
   "potion_heal": " <天赋>20</> ",
   "robe_flowstate": " <天赋>2</> ",
   "robe_infuse": " <天赋>20</> ",
   "robe_every": " <天赋>4</> ",
   "capture_flag": "ss3 shows 'All items infuse 25 .' (other build); tut05/f000 'Heal 20 .' and ss3 'Gain 2 stacks of Flowstate.' match"
  },
  "source": "数据表_修炼物品_通用 生命药剂_新手关 / 旧长袍; 数据表_技能_修炼物品 使用恢复生命 / 蓄能获得光阴 / 旧长袍; CORE-M-088"
 },
 {
  "id": "CORE-M-TV-031",
  "given": {
   "item": "旧剑 Old Sword",
   "data 基础伤害": {
    "c": 2.0,
    "e": 1
   },
   "skill": "造成普伤 [0] 基础伤害 1.0, [1] 3 整数",
   "原始描述": "下{1}次攻击额外造成{0}伤害。"
  },
  "when": "item growth (CORE-M-061) then 更新技能描述 at 等级 1/2/4/8",
  "then": {
   "描述": [
    {
     "等级": 1,
     "zh": "下 <天赋>3</> 次攻击额外造成 <天赋>20</> 伤害。"
    },
    {
     "等级": 2,
     "zh": "下 <天赋>3</> 次攻击额外造成 <天赋>40</> 伤害。"
    },
    {
     "等级": 4,
     "zh": "下 <天赋>3</> 次攻击额外造成 <天赋>80</> 伤害。"
    },
    {
     "等级": 8,
     "zh": "下 <天赋>3</> 次攻击额外造成 <天赋>160</> 伤害。"
    }
   ]
  },
  "source": "数据表_修炼物品_通用 旧剑; 数据表_技能_修炼物品 造成普伤 (761E648A4C11E87C96B7B59E22CA10BA); CORE-M-061/081"
 },
 {
  "id": "CORE-M-TV-032",
  "given": {
   "skills": {
    "恢复生命（%）[1]": {
     "提升值": 0.05,
     "不预算？": true
    },
    "治愈等于生命上限[1]": {
     "词条": "最大生命",
     "提升值": 0.15,
     "不预算？": true,
     "品质倍率？": true
    }
   },
   "levels": [
    1,
    2,
    4,
    8
   ]
  },
  "when": "根据参数生成文本 at each 等级",
  "then": {
   "恢复生命（%）": [
    " <天赋>5%</> ",
    " <天赋>10%</> ",
    " <天赋>20%</> ",
    " <天赋>40%</> "
   ],
   "治愈等于生命上限": [
    " <天赋>15%</> ",
    " <天赋>30%</> ",
    " <天赋>45%</> ",
    " <天赋>60%</> "
   ]
  },
  "source": "数据表_技能_修炼物品 恢复生命（%）/ 治愈等于生命上限; CORE-M-081 (lvlQ = FTrunc(log2 L)+1)"
 },
 {
  "id": "CORE-M-TV-033",
  "given": {
   "owner 格挡% (aggregate)": 0.1,
   "param": {
    "词条": "格挡%",
    "初始值": 1.0,
    "提升值": 1.0,
    "品质倍率？": true
   }
  },
  "when": "根据参数生成文本 at 等级 1/2/4/8 (owner stat held fixed at 0.1)",
  "then": {
   "texts": [
    " <天赋>20%</> ",
    " <天赋>30%</> ",
    " <天赋>40%</> ",
    " <天赋>50%</> "
   ],
   "rule": "'%' in 词条 → AsPercent(|stat × v|)"
  },
  "source": "数据表_技能_修炼物品 增加格挡; CORE-M-081"
 },
 {
  "id": "CORE-M-TV-034",
  "given": {
   "owner 基础伤害 来源映射": {
    "": 30,
    "永久保留": 5,
    "剑/附魔": 2,
    "buff": 100
   }
  },
  "when": "render params {词条:'y基础伤害', 提升值 1, 整数？}, {词条:'Y基础伤害', 提升值 1, 整数？}, {词条:'Y基础伤害', 提升值 0.5}, {词条:'基础伤害', 初始值 1} at 等级 1",
  "then": {
   "y_int": " <天赋>30</> ",
   "Y_int": " <天赋>37</> ",
   "Y_float": " <天赋>1,850%</> ",
   "plain": " <天赋>137</> "
  },
  "source": "函数库_工具 L1930-L1973; CORE-M-072/081"
 },
 {
  "id": "CORE-M-TV-035",
  "given": {
   "talent": "生命成长 params [0]{额外生命% 0.05 不预算} [1..3]{'' 0 0}",
   "预览等级": 1,
   "预览下N级？": true,
   "N": 1
  },
  "when": "生成能力描述参数(能力, 1, true, 1)",
  "then": {
   "描述中参数": [
    " <天赋>5%</> → <天赋>10%</> ",
    " <天赋>0%</> ",
    " <天赋>0%</> ",
    " <天赋>0%</> "
   ]
  },
  "source": "函数库_工具 L1987-L2041 (提升值==0 → no arrow); UI_天赋选项 L117-L118; CORE-M-084"
 },
 {
  "id": "CORE-M-TV-036",
  "given": {
   "原始描述": "{0}|{1}|{2}|{3}|{4}",
   "描述中参数": [
    "a",
    "b"
   ]
  },
  "when": "蓝图_能力.更新技能描述",
  "then": {
   "描述": "a|b|||"
  },
  "source": "蓝图_能力 L98-L144 (args 0..3 from Array_Get, 4 = empty Text); CORE-M-080"
 },
 {
  "id": "CORE-M-TV-037",
  "given": {
   "player 格挡减伤%": {
    "计算类型": "乘算",
    "来源映射": {
     "": {
      "c": 1.5,
      "e": -1
     }
    }
   },
   "player 强固减伤%": {
    "计算类型": "加算",
    "来源映射": {
     "": {
      "c": 5.0,
      "e": -1
     }
    }
   }
  },
  "when": "词条说明参数 on 格挡.说明 (A7CAE9ED…) and 护甲.说明 (4AAA9626…)",
  "then": {
   "格挡_zh": "每层<词条>格挡</>可以使受到的伤害减少<词条>15%</>。",
   "护甲_zh": "<词条>强固</>可以抵消50%受到的伤害。",
   "格挡_en": "Each stack of <词条>Block</>: Reduce Damage Taken by <词条>15%</>.",
   "护甲_en": "<词条>Shield</> absorbs 50% of Damage Taken."
  },
  "source": "函数库_工具 L50-L86; 数据表_玩家 (幽冥骑士 etc.); 数据表_词条_物品 格挡/护甲 说明; CORE-M-086"
 },
 {
  "id": "CORE-M-TV-038",
  "given": {
   "P": [
    0.05,
    0.25,
    0.5,
    1.0,
    1.5,
    5e-05,
    6e-05,
    0.0
   ]
  },
  "when": "native CfromP (sub_1445ac2e0)",
  "then": {
   "C": [
    0.00380859375,
    0.084716796875,
    0.3021240234375,
    0.999969482421875,
    0.999969482421875,
    0.0,
    1.46484375e-08,
    0.0
   ]
  },
  "source": "exe 0x1445ac2e0-0x1445ac783 (5e-05 cut-off @0x1476d5290, 80 iterations, min(P,1)); CORE-M-092/096"
 },
 {
  "id": "CORE-M-TV-039",
  "given": {
   "C": 0.084716796875,
   "n": [
    1,
    2,
    3,
    4,
    5,
    12,
    13
   ]
  },
  "when": "pEff(C, n) (sub_1445b31b0) expressed as m = pEff × 32768",
  "then": {
   "m": [
    2776,
    5552,
    8328,
    11104,
    13880,
    32768,
    32768
   ]
  },
  "source": "exe 0x1445b31b0 (float 1/32767 = 0x38000100, ×2^-15); CORE-M-093"
 },
 {
  "id": "CORE-M-TV-040",
  "given": {
   "x": [
    0.1,
    0.25,
    0.5,
    1.0,
    1e-06,
    0.003802
   ]
  },
  "when": "m(x) = #{k∈[0,32767] : fround(fround(k)·F) < x}",
  "then": {
   "m": [
    3277,
    8192,
    16384,
    32767,
    1,
    125
   ]
  },
  "source": "CORE-M-093/100 (same quantiser as 传统概率判断)"
 },
 {
  "id": "CORE-M-TV-041",
  "given": {
   "calls": [
    {
     "P": 0.3,
     "TriggerCount": 0,
     "Attempts": 1
    },
    {
     "P": 0.3,
     "TriggerCount": -2,
     "Attempts": 2
    },
    {
     "P": 0.0,
     "TriggerCount": 5,
     "Attempts": 3
    },
    {
     "P": 4e-05,
     "TriggerCount": 1,
     "Attempts": 10
    },
    {
     "P": 0.3,
     "TriggerCount": 3,
     "Attempts": 0
    }
   ]
  },
  "when": "RollPRDBatch (deterministic cases: no attempt is rolled)",
  "then": {
   "results": [
    {
     "Triggered": false,
     "SuccessCount": 0,
     "NextTriggerCount": 1
    },
    {
     "Triggered": false,
     "SuccessCount": 0,
     "NextTriggerCount": 0
    },
    {
     "Triggered": false,
     "SuccessCount": 0,
     "NextTriggerCount": 8
    },
    {
     "Triggered": false,
     "SuccessCount": 0,
     "NextTriggerCount": 11
    },
    {
     "Triggered": false,
     "SuccessCount": 0,
     "NextTriggerCount": 3
    }
   ],
   "rand15_draws": 0
  },
  "source": "exe 0x1445a65e0-0x1445a6652 (C<=0 branch, n<1 pre-consume); CORE-M-091/094"
 },
 {
  "id": "CORE-M-TV-042",
  "given": {
   "P": 0.3,
   "C": 0.11894531249999998,
   "TriggerCount": 2,
   "Attempts": 4,
   "rand15": [
    5000,
    30000,
    2000,
    32767
   ]
  },
  "when": "port rollPrdBatch (CORE-M-094): one rand15 per attempt, success iff k < m(n·C)",
  "then": {
   "trace": [
    {
     "n": 2,
     "m": 7795,
     "rand15": 5000,
     "success": true
    },
    {
     "n": 1,
     "m": 3898,
     "rand15": 30000,
     "success": false
    },
    {
     "n": 2,
     "m": 7795,
     "rand15": 2000,
     "success": true
    },
    {
     "n": 1,
     "m": 3898,
     "rand15": 32767,
     "success": false
    }
   ],
   "SuccessCount": 2,
   "Triggered": true,
   "NextTriggerCount": 2
  },
  "source": "CORE-M-094"
 },
 {
  "id": "CORE-M-TV-043",
  "given": {
   "暴击率%": [
    1.0,
    1.2,
    0.0
   ],
   "触发次数": 3,
   "暴击保护计数": 4
  },
  "when": "BP_ManeActor.会心判断(3)",
  "then": {
   "1.0": {
    "会心次数": 3,
    "触发？": true,
    "暴击保护计数": 1,
    "draws": 0
   },
   "1.2": {
    "会心次数": 3,
    "触发？": true,
    "暴击保护计数": 1,
    "draws": 0
   },
   "0.0": {
    "会心次数": 0,
    "触发？": false,
    "暴击保护计数": 4,
    "draws": 0
   }
  },
  "source": "BP_ManeActor L1242-L1300 (L1255 >= 1.0 branch, L1251 > 0 check); CORE-M-097"
 },
 {
  "id": "CORE-M-TV-044",
  "given": {
   "概率": [
    1.0,
    0.777,
    0.75,
    0.5,
    0.1,
    1e-09,
    0.0
   ]
  },
  "when": "传统概率判断(概率): successes over the 32768 equally likely rand15 values",
  "then": {
   "successes": [
    32767,
    25460,
    24576,
    16384,
    3277,
    1,
    0
   ],
   "fails_only_at_k": "for 1.0: k = 32767 (FRand = 1.0f)"
  },
  "source": "函数库_工具 L1536-L1543; RandomFloatInRange exe 0x143b9e4c0; CORE-M-100 QUIRK"
 },
 {
  "id": "CORE-M-TV-045",
  "given": {
   "条件.概率": [
    100,
    50,
    25,
    0
   ],
   "角色类型": "1 深渊"
  },
  "when": "蓝图_能力.检查条件 roll RandomIntegerInRange(0,100) <= 概率: successes over 32768 rand15 values; plus RandomIntegerInRange(0,100) at rand15 0 / 16383 / 32767",
  "then": {
   "successes": [
    32768,
    16546,
    8436,
    325
   ],
   "samples": [
    0,
    50,
    100
   ]
  },
  "source": "蓝图_能力 UG L8299 (pseudo L564-L568); FMath::RandRange exe 0x141f74c00; CORE-M-102 QUIRK"
 },
 {
  "id": "CORE-M-TV-046",
  "given": {
   "强化次数": 5,
   "每次概率": 0.2,
   "被强化属性": 0,
   "RandomFloatInRange(0,1) outputs": [
    0.9,
    0.85,
    0.1,
    0.5,
    0.15,
    0.0
   ]
  },
  "when": "递减强化属性(5, 0.2, X)",
  "then": {
   "thresholds": [
    1.0,
    0.8,
    0.6,
    0.4,
    0.2,
    0.0
   ],
   "draws": 6,
   "X": 4
  },
  "source": "函数库_工具 L2688-L2713; 蓝图_动作游戏模式 L3561; CORE-M-108 QUIRK (i = N threshold 0)"
 },
 {
  "id": "CORE-M-TV-047",
  "given": {
   "seeds": [
    0,
    90,
    12345
   ]
  },
  "when": "MakeRandomStream(seed) then 3× GetFraction",
  "then": {
   "0": [
    {
     "Seed": 907633515,
     "frac": 0.2113248109817505
    },
    {
     "Seed": 2641306770,
     "frac": 0.6149771213531494
    },
    {
     "Seed": 4111285669,
     "frac": 0.957233190536499
    }
   ],
   "90": [
    {
     "Seed": 1396039181,
     "frac": 0.32504069805145264
    },
    {
     "Seed": 148246556,
     "frac": 0.034516334533691406
    },
    {
     "Seed": 3796707639,
     "frac": 0.8839898109436035
    }
   ],
   "12345": [
    {
     "Seed": 2044445496,
     "frac": 0.4760094881057739
    },
    {
     "Seed": 2842275331,
     "frac": 0.6617687940597534
    },
    {
     "Seed": 2479683082,
     "frac": 0.5773462057113647
    }
   ]
  },
  "source": "exe 0x143b9ebd0 / 0x143b9e5c0 (imul 0x0BB38435, add 0x3619636B, (Seed>>9)|0x3F800000); 蓝图_动作游戏模式 L167 default {InitialSeed 90, Seed 0}: draws before the reseed follow the seed-0 row; CORE-M-121"
 },
 {
  "id": "CORE-M-TV-048",
  "given": {
   "权重组": [
    100,
    100,
    50
   ],
   "Stream": "MakeRandomStream(12345)"
  },
  "when": "权重选取 five times on the same stream",
  "then": {
   "r": [
    120,
    166,
    145,
    240,
    7
   ],
   "选中的序号": [
    1,
    1,
    1,
    2,
    0
   ]
  },
  "source": "函数库_工具 L1472-L1533; CORE-M-104"
 },
 {
  "id": "CORE-M-TV-049",
  "given": {
   "权重组": [
    0,
    0
   ],
   "Stream": "MakeRandomStream(7)"
  },
  "when": "权重选取; and RandomIntegerInRangeFromStream(Stream, 1, 0)",
  "then": {
   "选中": "none (port returns -1)",
   "r": 1,
   "Seed_after": 7,
   "stream_advanced": false
  },
  "source": "exe 0x143b9ecd2 (R<=0 → Min, no mutate); 函数库_工具 L1055; CORE-M-104/121"
 },
 {
  "id": "CORE-M-TV-050",
  "given": {
   "权重数据表组": [
    {
     "权重": 100,
     "行": "A"
    },
    {
     "权重": 100,
     "行": "B"
    },
    {
     "权重": 50,
     "行": "C"
    }
   ],
   "数量": 2,
   "Stream": "MakeRandomStream(12345)"
  },
  "when": "权重创建数组(2, 组, Stream)",
  "then": {
   "选出的数组": [
    "B",
    "A"
   ]
  },
  "source": "函数库_工具 L916-L946 (without replacement); CORE-M-105"
 },
 {
  "id": "CORE-M-TV-051",
  "given": {
   "array": [
    "A",
    "B",
    "C",
    "D"
   ],
   "Stream": "MakeRandomStream(42)"
  },
  "when": "Array_ShuffleFromStream",
  "then": {
   "result": [
    "A",
    "B",
    "D",
    "C"
   ],
   "mutations": 4
  },
  "source": "exe 0x143b50950; CORE-M-121"
 },
 {
  "id": "CORE-M-TV-052",
  "given": {
   "被随机": 100.0,
   "吸附单位": 1.0,
   "加减浮动？": true,
   "浮动范围": 15.0,
   "取整？": false,
   "Stream": "MakeRandomStream(42)"
  },
  "when": "随机化(...)",
  "then": {
   "区间": {
    "Min": 85.0,
    "Max": 115.0
   },
   "raw": 88.93177032470703,
   "随机后": 89.0
  },
  "source": "函数库_工具 L2716-L2750; 蓝图_能力_旋风地震 L97 uses (·,1,true,15,false); CORE-M-110"
 },
 {
  "id": "CORE-M-TV-053",
  "given": {
   "层配置.标签": "empty",
   "层种子": 777
  },
  "when": "获取附魔标签",
  "then": {
   "OutItem": "可交互.修炼牌.附魔.治愈"
  },
  "source": "函数库_工具 L857-L870 (fallback tag order 充能, 伤害, 治愈, 护甲); CORE-M-122"
 },
 {
  "id": "CORE-M-TV-054",
  "given": {
   "cases": [
    [
     95,
     10,
     100
    ],
    [
     30,
     10,
     100
    ],
    [
     250,
     0,
     100
    ]
   ]
  },
  "when": "计算除余数(累计值, 添加值, 触发阈值)",
  "then": {
   "results": [
    {
     "超出阈值？": true,
     "除数": 1,
     "余数": 5.0
    },
    {
     "超出阈值？": false,
     "除数": 0,
     "余数": 40.0
    },
    {
     "超出阈值？": true,
     "除数": 2,
     "余数": 50.0
    }
   ]
  },
  "source": "函数库_工具 L778-L791; CORE-M-111"
 },
 {
  "id": "CORE-M-TV-055",
  "given": {
   "cases": [
    {
     "累计值": {
      "c": 2.4,
      "e": 2
     },
     "添加值": {
      "c": 1.0,
      "e": 1
     },
     "触发阈值": {
      "c": 1.0,
      "e": 1
     }
    },
    {
     "累计值": {
      "c": 1.5,
      "e": 1
     },
     "添加值": {
      "c": 1.0,
      "e": 1
     },
     "触发阈值": {
      "c": 2.0,
      "e": 1
     }
    }
   ]
  },
  "when": "计算除余数（科学）",
  "then": {
   "case1": {
    "超出阈值？": true,
    "除数": {
     "c": 2.0,
     "e": 1
    },
    "余数": {
     "c": 5.0,
     "e": 1
    },
    "note": "QUIRK: true quotient 25, remainder 0"
   },
   "case2": {
    "超出阈值？": true,
    "除数": {
     "c": 1.0,
     "e": 0
    },
    "余数": {
     "c": 5.0,
     "e": 0
    }
   }
  },
  "source": "函数库_工具 L679-L696; CORE-M-111 QUIRK"
 },
 {
  "id": "CORE-M-TV-056",
  "given": {
   "乘数强化属性": [
    10.0,
    1.0,
    0.1,
    5
   ],
   "叠加映射属性": {
    "map": {
     "a": 2.0
    },
    "calls": [
     [
      "a",
      3.0,
      -1.0
     ],
     [
      "a",
      3.0,
      6.0
     ],
     [
      "b",
      4.0,
      1.5
     ]
    ]
   }
  },
  "when": "乘数强化属性(强化前, 成长率修正, 成长率, 等级); 叠加映射属性 applied in order",
  "then": {
   "强化后": 15.0,
   "map_after": {
    "a": 6.0,
    "b": 1.5
   }
  },
  "source": "函数库_工具 L1276-L1287; 函数库_技能 L472-L483; CORE-M-063/109"
 },
 {
  "id": "CORE-M-TV-057",
  "given": {
   "当前环节": [
    7,
    3
   ]
  },
  "when": "投掷骰子()",
  "then": {
   "当前环节_after": [
    0,
    3
   ],
   "draws": 0
  },
  "source": "蓝图_动作游戏模式 L5191, UG L20521 → L19742 → L18433; CORE-M-112"
 }
];
