// ============================================
// Grid: worked example of curried generics + column refs
// ============================================

// Grid is a fn (typespec 1.10) that locks in the row type.
// fn Grid<TRow extends State>(): GridBase<TRow>;

model GridBase<TRow extends State> {
  rows: TRow[];
  selection: TRow | null;
  sort: { field: string; dir: "asc" | "desc" } | null;
}

// RefCol: direct field reference. Auto cell renderer.
model RefCol<TGrid, TField extends string> {
  grid: TGrid;
  field: TField;
  // Emitter resolves TGrid.rows[0][TField] -> gets field type
}

// Col: derived/custom column with inline component + effects.
model Col<TGrid, TLabel extends string, TCell> {
  grid: TGrid;
  label: TLabel;
  cell: TCell;
}

// ── Example ──

model UserRow extends ScopeState {
  id: UserId;
  name: string = "";
  email: string = "";
  status: "active" | "suspended" = "active";
}

// alias UserGrid = Grid<UserRow>();

// model UserGridImpl extends UserGrid {
//   colName: RefCol<UserGrid, "name">;
//   colEmail: RefCol<UserGrid, "email">;
//   colAvatar: Col<UserGrid, "avatar", InlineComponent<
//     { userId: UserId },
//     [FetchAvatar]            // effect visible in grid type -> N+1 detectable
//   >>;
// }
