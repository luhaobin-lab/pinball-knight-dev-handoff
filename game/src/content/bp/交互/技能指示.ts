/** 技能指示.txt 创建地形格组 L88–8708 and fixed-area close L3460/L3776.
 * Only the fixed terrain path is ported here. Other indicator types retain their existing presentation path.
 * Preview blocks are presentation; the source creates real terrain cells as well, even with previews enabled.
 */
import { BpObject } from '../../../core/sim/object.ts';
import type { BP_ManeActor } from '../../../core/sim/actor.ts';
import { 函数库_工具 } from '../../../core/bp/index.ts';
import { 效果配置From, structOf } from '../../../core/bp/structs.ts';
import type { AssetPath, 枚举_技能指示 } from '../../demo/types.ts';
import type { 结构_地形选取配置 } from '../../demo/types.ts';
import type { Vec3 } from '../../../core/sim/types.ts';
import type { World } from '../../../core/sim/world.ts';
import { 蓝图_效果_地形 } from '../Skill/效果/蓝图_效果_地形.ts';
import { 蓝图_效果_地形管理组 } from '../Skill/效果/物品/蓝图_效果_地形管理组.ts';
import { attachSourceEffect, terrainGroupConfig } from '../../../core/ability/apply.ts';

export class 技能指示 extends BpObject {
  static override readonly path: AssetPath = 'CatapultHero/BP/交互/技能指示';
  拥有者: BP_ManeActor | null = null;
  地形选取配置 = structOf('结构_地形选取配置');
  指示类型: 枚举_技能指示 = '地形区域（固定）';
  圈大小 = 0;
  当前终点位置: Vec3 = { x:0,y:0,z:0 };
  列宽 = 0;
  ug_previewGroup: 蓝图_效果_地形管理组 | null = null;
  视觉地块位置: { x: number; y: number; z: number }[] = [];
  激活指示(owner: BP_ManeActor, kind: 枚举_技能指示): void {
    this.拥有者 = owner; this.指示类型 = kind;
    owner.更新运动数据();
    if (kind === '地形区域（固定）') this.创建地形格组();
    if (kind === '地形区域（实时）') this.启用地形预览();
    if (kind === '指定位置（固定）') this.K2_SetActorLocation(owner.目标位置);
  }
  启用地形预览(): void {
    const owner=this.拥有者,skill=owner?.当前能力;
    if(owner&&skill)this.ug_previewGroup=attachSourceEffect(this,owner,skill,terrainGroupConfig(),true);
    this.列宽=2*Math.max(0,Math.min(3,this.地形选取配置.起始范围))+1;
    // Source visual blocks start inactive; real terrain is created only by the confirmed ability.
    this.视觉地块位置=[];
  }
  更新地形预览(target: Vec3): void {
    if(this.指示类型!=='地形区域（实时）')return;
    this.当前终点位置={...target};
    const api=this.world.sys.ability as { previewTerrain(w:World,cfg:结构_地形选取配置,at:Vec3):{config:结构_地形选取配置;cells:Vec3[]} };
    const p=api.previewTerrain(this.world,this.地形选取配置,target);
    this.地形选取配置=p.config;
    // Source's fixed visual array is clamped to radius3, even if the legal group extends farther.
    const centre=this.地形选取配置.起点[0]!,r=this.地形选取配置.起始范围;
    this.视觉地块位置=p.cells.filter(p=>p.x>=centre.X-r*64&&p.y>=centre.Y-r*64&&p.x<centre.X-r*64+this.列宽*64&&p.y<centre.Y-r*64+this.列宽*64);
  }
  创建地形格组(): void {
    const owner = this.拥有者, skill = owner?.当前能力;
    if (!owner || !skill) return;
    const groups = 函数库_工具.选择合法地形(this, this.地形选取配置, this.world.mode).选取到的格子;
    // L1317…3981 creates and attaches the manager WITHOUT 激活效果 (which would spawn cells a second time).
    const group = attachSourceEffect<蓝图_效果_地形管理组>(this, owner, skill, terrainGroupConfig(), true);
    if (!group) return;
    for (const g of groups) for (let i = 0; i < g.真实坐标.length; i++) {
      const p = g.真实坐标[i]!, at = { x: p.X, y: p.Y, z: p.Z };
      if (this.地形选取配置['开启预览框?']) {
        if (this.视觉地块位置.some(q => q.x === at.x && q.y === at.y && q.z === at.z)) continue;
        this.视觉地块位置.push(at);
        this.fx.ui({ op: 'update', widget: '地块指示', data: { indicator: this.id, at, 序号: g.序号 } });
      }
      const cell = attachSourceEffect<蓝图_效果_地形>(this, owner, skill, 效果配置From(this.地形选取配置.格子类));
      if (!(cell instanceof 蓝图_效果_地形)) continue;
      cell.K2_DetachFromActor(); group.拥有的地形.push(cell);
      cell.序号 = g.序号; cell.中心格 = i === 0; cell.所在位置 = at;
      cell.K2_SetActorLocation(at); cell.地形管理组 = group; cell.激活效果('');
      // L6147: no 主动激活 here, regardless of the visual-preview flag.
    }
    skill.地形管理组 = group;
  }
  关闭指示(_kind: 枚举_技能指示): void {
    this.fx.ui({ op: 'close', widget: '地块指示', data: { indicator: this.id } });
    this.视觉地块位置.length = 0;
    // L3776 → L15: type 6 immediately destroys its indicator, not the independently attached real cells.
    函数库_工具.销毁目标和子物体(this, this);
  }
}
