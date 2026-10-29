import{it,expect}from'vitest';import{ProjectileStage}from'../../src/game/room/projectiles';import{roomFrame}from'../../src/game/room/build';
it('actual spirit projectile has a distinct orb mapping and finite source-stop presentation',()=>{
 const s=new ProjectileStage(roomFrame({cols:5,rows:7,tile:64}as never)),p={id:1,cls:'CatapultHero/BP/Skill/发射物/蓝图_发射物_齐刘海飞弹',position:{x:0,y:0,z:5},radius:20,active:true,stopped:false,startedAt:0};
 s.sync([p],.1);expect(s.group.userData).toMatchObject({projectiles:1,visibleSprites:1,unmapped:[]});
 s.sync([{...p,active:false,stopped:true,stoppedAt:.2}],.7);expect(s.group.userData.visibleSprites).toBe(0);expect(s.group.userData.projectiles).toBe(1);s.sync([],3);expect(s.group.userData.projectiles).toBe(0);s.dispose();
});
