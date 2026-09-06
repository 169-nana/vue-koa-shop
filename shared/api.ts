// 前后端共用的接口契约；这里只放类型，不引入数据库或浏览器代码。
export type ApiResponse<T> =
  | { errno: 0; data: T; errmsg: string }
  | { errno: 1 | 2; data: null; errmsg: string }
export interface Credentials { username: string; password: string }
export interface LoginResult { token: string }
export interface PublicUser { id: number; username: string; avatar: string }
export type PublicAdmin = PublicUser
export interface RegisterResult { id: number; username: string }
export interface IdInput { id: number }
export interface InsertResult { insertId: number }
export interface CategoryInput { name: string; pid: number; picture: string }
export interface Category extends CategoryInput { id: number }
export interface CategoryNode extends Category { children: CategoryNode[] }
export interface GoodsInput {
  name: string; category_id: number; price: number; stock: number;
  picture: string; album: string[]; spec: string; description: string
}
export interface Goods extends Omit<GoodsInput, 'album'> { id: number }
export interface GoodsListItem extends Goods { category_name: string | null; parent_category_name: string | null }
export interface AlbumImage { id: number; goods_id: number; picture: string }
export interface GoodsDetail extends Goods { album: AlbumImage[] }
export interface GoodsQuery {
  page?: number; pagesize?: number; keyword?: string; category_id?: number;
  min_price?: number; max_price?: number; min_stock?: number; max_stock?: number
}
export interface PageResult<T> { list: T[]; total: number }

/**
 * 前台商品列表的查询参数。
 *
 * 这里描述的是前端调用接口时允许传入的参数，
 * 所以使用接口中的 snake_case 命名。
 */
export interface PublicGoodsQuery {
  last_id?: number
  pagesize?: number
  category_id?: number
}

/**
 * 游标分页结果。
 *
 * T 是泛型，调用者可以决定 list 中放什么类型。
 * 例如 CursorPageResult<Goods> 表示商品分页结果。
 */
export interface CursorPageResult<T> {
  list: T[]
  hasMore: boolean
  nextLastId: number
}
export interface UploadResult { savepath: string; url?: string }
