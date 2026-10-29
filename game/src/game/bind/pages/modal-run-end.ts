import { button, type PageBinding } from '../page-model';

/** UI_冒险结束统计页: score lines, the exploration level bar and the Demo-complete text, 继续. */
const binding: PageBinding = {
  id: 'run-end',
  modal: true,
  match: v => v.modal?.kind === 'runEnd',
  model: (v, legal) => {
    const m = v.modal;
    if (m?.kind !== 'runEnd') throw new Error('run-end binding on another modal');
    return {
      id: 'run-end',
      title: '冒险结束',
      lines: [
        ...m.lines.map(l => `${l.label}  ${l.value}`),
        `总分  ${m.score}`,
        `探索等级 ${m.exploration.level}  ${m.exploration.progress}/${m.exploration.need}`,
        // SPEC-GAP: the Demo-complete text of PROTOTYPE_SCOPE §5.5 comes with the ui-pages run-end page
        ...(m.demoComplete ? ['DEMO 已完成'] : []),
      ],
      layout: 'screen',
      buttons: [button(legal, '继续', { type: 'runEnd.continue' })],
    };
  },
};
export default binding;
