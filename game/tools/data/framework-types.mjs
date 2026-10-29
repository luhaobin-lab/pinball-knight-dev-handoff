// The hand-written part of src/content/demo/types.ts: shapes shared by every imported asset.
export const FRAMEWORK_TYPES = `
// ---- Shapes shared by every imported asset. ----

/**
 * Asset path in the Demo: the package path minus /Game/, e.g. "CatapultHero/BP/Skill/Ability/蓝图_能力_治愈_强固".
 * It follows the dump's layout (dump/blueprints-pseudo/<path>.txt, dump/datatables/<path>.json, ...). The object
 * name follows a "." only when it is not the package name or its "_C" class.
 */
export type AssetPath = string;

/** FText: the zh source text and its English localization; en repeats zh where the Demo has no translation. */
export interface FText {
  readonly zh: string;
  readonly en: string;
}

/** A row of another table. DataTable null (RowName "None") means no row. */
export interface DataTableRowHandle {
  readonly DataTable: AssetPath | null;
  readonly RowName: string;
}

export type GameplayTag = string;
export type GameplayTagContainer = readonly GameplayTag[];

export interface InputRange {
  readonly Min: number;
  readonly Max: number;
}

export interface Vector {
  readonly X: number;
  readonly Y: number;
  readonly Z: number;
}

export interface Vector2D {
  readonly X: number;
  readonly Y: number;
}

export interface Quat {
  readonly X: number;
  readonly Y: number;
  readonly Z: number;
  readonly W: number;
}

export interface Transform {
  readonly Rotation: Quat;
  readonly Translation: Vector;
  readonly Scale3D: Vector;
}

/** A Demo DataTable: rows by row name, in the Demo's order (the order GetDataTableRowNames returns). */
export interface DemoTable<Row, Key extends string = string> {
  /** Asset path, e.g. "CatapultHero/数据表/角色/数据表_玩家". */
  readonly asset: AssetPath;
  readonly class: 'DataTable' | 'CompositeDataTable';
  /** The row struct: a key of DemoStructTypes, or the engine struct RichTextStyleRow. */
  readonly row_struct: string;
  /** True for tables in a 过期 (deprecated) folder: kept as data, not exported from index.ts. */
  readonly deprecated: boolean;
  /** Kept rows that need care (designer notes stored as rows, references to missing rows, ...): reasons by row. */
  readonly flags: Readonly<Partial<Record<Key, string>>>;
  /** The rows; rows the dump marks as tests are dropped (manifest.json lists them). */
  readonly rows: Readonly<Record<Key, Row>>;
}

/** A Demo CompositeDataTable, resolved from its parents: a later parent's row replaces an earlier one in place. */
export interface DemoCompositeTable<Row, Key extends string = string> extends DemoTable<Row, Key> {
  readonly class: 'CompositeDataTable';
  readonly parent_tables: readonly AssetPath[];
}

/** RichTextStyleRow (UMG): the text style of one rich-text tag such as <强调>; untyped below TextStyle. */
export interface RichTextStyleRow {
  readonly TextStyle: { readonly [field: string]: unknown };
}

export type RichCurveInterpMode = 'RCIM_Linear' | 'RCIM_Constant' | 'RCIM_Cubic' | 'RCIM_None';
export type RichCurveTangentMode = 'RCTM_Auto' | 'RCTM_User' | 'RCTM_Break' | 'RCTM_None' | 'RCTM_SmartAuto';
export type RichCurveTangentWeightMode = 'RCTWM_WeightedNone' | 'RCTWM_WeightedArrive' | 'RCTWM_WeightedLeave' | 'RCTWM_WeightedBoth';
export type RichCurveExtrapolation = 'RCCE_Cycle' | 'RCCE_CycleWithOffset' | 'RCCE_Oscillate' | 'RCCE_Linear' | 'RCCE_Constant' | 'RCCE_None';

/** FRichCurveKey. */
export interface RichCurveKey {
  readonly InterpMode: RichCurveInterpMode;
  readonly TangentMode: RichCurveTangentMode;
  readonly TangentWeightMode: RichCurveTangentWeightMode;
  readonly Time: number;
  readonly Value: number;
  readonly ArriveTangent: number;
  readonly ArriveTangentWeight: number;
  readonly LeaveTangent: number;
  readonly LeaveTangentWeight: number;
}

/** FRichCurve. DefaultValue and the extrapolations are the engine defaults where the cooked asset omits them. */
export interface RichCurve {
  readonly Keys: readonly RichCurveKey[];
  readonly DefaultValue: number;
  readonly PreInfinityExtrap: RichCurveExtrapolation;
  readonly PostInfinityExtrap: RichCurveExtrapolation;
}

/** A Demo CurveTable (曲线表, 评分衰减曲线): one RichCurve per row. */
export interface DemoCurveTable<Key extends string = string> {
  readonly asset: AssetPath;
  readonly name: string;
  readonly class: 'CurveTable';
  readonly mode: 'RichCurves';
  readonly rows: Readonly<Record<Key, RichCurve>>;
}

/** A blueprint timeline curve (UCurveFloat); outer is the owning blueprint class. */
export interface DemoCurveFloat {
  readonly name: string;
  readonly class: 'CurveFloat';
  readonly outer: AssetPath;
  readonly FloatCurve: RichCurve;
}

/** UCurveLinearColor: FloatCurves are the R, G, B and A channels. */
export interface DemoCurveLinearColor {
  readonly name: string;
  readonly class: 'CurveLinearColor';
  readonly FloatCurves: readonly [RichCurve, RichCurve, RichCurve, RichCurve];
}

export interface DemoCurveAsset {
  /** True for curves of blueprints in a 过期 (deprecated) folder. */
  readonly deprecated: boolean;
  readonly curves: readonly (DemoCurveFloat | DemoCurveLinearColor)[];
}

/** A user enum: values in UE order; display is what rows hold (null for the hidden 枚举_MAX). */
export interface DemoEnum<Display extends string = string> {
  readonly asset: AssetPath;
  readonly cpp_form: string;
  readonly values: readonly { readonly name: string; readonly value: number; readonly display: Display | null }[];
}

/** A user struct: its fields (types as written in the dump; raw_name keeps the GUID suffix) and its default value. */
export interface DemoStruct<T> {
  readonly asset: AssetPath;
  readonly fields: readonly { readonly name: string; readonly raw_name: string; readonly type: string }[];
  readonly defaults: T;
}

export type DemoEnums = { readonly [K in keyof DemoEnumTypes]: DemoEnum<DemoEnumTypes[K]> };
export type DemoStructs = { readonly [K in keyof DemoStructTypes]: DemoStruct<DemoStructTypes[K]> };
`;
