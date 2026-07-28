/** productID → 品种中文名（SimNow 柜台不返中文名，前端本地映射，132 品种全覆盖） */
export const PRODUCT_NAMES: Record<string, string> = {
  // ---- CFFEX 中金所 ----
  IF: '沪深300', IC: '中证500', IH: '上证50', IM: '中证1000',
  T: '10年国债', TF: '5年国债', TS: '2年国债', TL: '30年国债',
  IO: '沪深300期权', HO: '中证500期权', MO: '中证1000期权',

  // ---- CZCE 郑商所 ----
  AP: '苹果', CF: '棉花', CJ: '红枣', CY: '棉纱',
  FG: '玻璃', FGC: '玻璃', FGP: '玻璃',
  JR: '粳稻',
  MA: '甲醇', MAC: '甲醇', MAP: '甲醇',
  OI: '菜籽油', PF: '短纤', PK: '花生',
  PL: '瓶片', PM: '普麦', PR: '瓶片', PX: '对二甲苯',
  RI: '早籼稻', RM: '菜籽粕', RMC: '菜籽粕', RMP: '菜籽粕', RS: '油菜籽',
  SA: '纯碱', SAC: '纯碱', SAP: '纯碱',
  SF: '硅铁', SH: '烧碱', SM: '锰硅',
  SR: '白糖', SRC: '白糖', SRP: '白糖',
  TA: 'PTA', TAC: 'PTA', TAP: 'PTA',
  UR: '尿素', WH: '强麦', ZC: '动力煤',

  // ---- SHFE 上期所 ----
  cu: '沪铜', al: '沪铝', zn: '沪锌', pb: '沪铅',
  ni: '沪镍', sn: '沪锡', au: '沪金', ag: '沪银',
  rb: '螺纹钢', wr: '线材', hc: '热卷', ss: '不锈钢',
  fu: '燃料油', bu: '石油沥青', ru: '天然橡胶', sp: '纸浆',
  ad: '沥青', ao: '氧化铝', br: '丁二烯橡胶', op: '原油',
  // SHFE 期权（_o 后缀 → 对应标的）
  ad_o: '沥青', ag_o: '沪银', al_o: '沪铝', ao_o: '氧化铝',
  au_o: '沪金', br_o: '丁二烯橡胶', bu_o: '石油沥青',
  cu_o: '沪铜', fu_o: '燃料油', ni_o: '沪镍',
  op_o: '原油', pb_o: '沪铅', rb_o: '螺纹钢',
  ru_o: '天然橡胶', sn_o: '沪锡', sp_o: '纸浆',
  zn_o: '沪锌',

  // ---- DCE 大商所 ----
  a: '豆一', b: '豆二', bb: '胶合板', c: '玉米', cs: '玉米淀粉',
  eb: '苯乙烯', eg: '乙二醇', fb: '纤维板',
  i: '铁矿石', j: '焦炭', jd: '鸡蛋', jm: '焦煤',
  l: '塑料', lg: '液化石油气', lh: '生猪',
  m: '豆粕', p: '棕榈油', pg: '液化气', pp: '聚丙烯',
  rr: '粳米', v: 'PVC', y: '豆油',
  bz: '瓶片',
  // DCE 期权
  bz_o: '瓶片', c_o: '玉米', eb_o: '苯乙烯',
  i_o: '铁矿石', m_o: '豆粕', p_o: '棕榈油',

  // ---- INE 上海国际能源 ----
  bc: '国际铜', ec: '集运(欧线)', lu: '低硫燃油',
  nr: '20号胶', sc: '原油',
  nr_o: '20号胶', sc_o: '原油',

  // ---- GFEX 广期所 ----
  lc: '碳酸锂', pd: '工业硅', ps: '工业硅', pt: '工业硅', si: '工业硅',
  lc_o: '碳酸锂', pd_o: '工业硅', ps_o: '工业硅', pt_o: '工业硅', si_o: '工业硅',
}

/** 根据 productID 查中文名 */
export function getProductName(productID: string): string {
  return PRODUCT_NAMES[productID] || productID
}
