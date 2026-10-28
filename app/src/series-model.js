export const initialSeriesState = () => ({
  groups: [],
  selected: null,
  rows: [],
  chapters: [],
  paper: null,
  nextCursor: null,
  filters: {},
  entitlement: null,
  billingKnown: false,
  loading: false,
  error: "",
  busy: false,
});
// One bounded state machine shared by the native screen and interaction checks.
export class NativeSeriesModel {
  constructor(api, onChange) {
    this.api = api;
    this.onChange = onChange;
    this.state = initialSeriesState();
    this.alive = true;
    this.groupVersion = 0;
    this.pageVersion = 0;
    this.moreBusy = false;
    this.startBusy = false;
  }
  emit(patch) {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }
  dispose() {
    this.alive = false;
    this.groupVersion++;
    this.pageVersion++;
  }
  async refresh() {
    this.alive = true;
    this.startBusy = false;
    const version = ++this.groupVersion;
    this.emit({ loading: true, error: "", busy: false });
    const results = await Promise.allSettled([
      this.api("/test-series"),
      this.api("/billing"),
    ]);
    if (!this.alive || version !== this.groupVersion) return;
    if (results[0].status !== "fulfilled") {
      this.emit({ loading: false, error: results[0].reason.message });
      return;
    }
    const groups = results[0].value;
    const selected =
      groups.find((g) => g.id === this.state.selected?.id) || null;
    this.emit({
      groups,
      selected,
      entitlement:
        results[1].status === "fulfilled"
          ? results[1].value.entitlement
          : this.state.entitlement,
      billingKnown: results[1].status === "fulfilled",
      loading: false,
    });
    if (selected) await this.loadPage();
    else {
      this.pageVersion++;
      this.emit({ rows: [], chapters: [], paper: null, nextCursor: null });
    }
  }
  select(group) {
    this.groupVersion++;
    this.emit({ selected: group, filters: {}, error: "" });
    return this.loadPage();
  }
  back() {
    this.groupVersion++;
    this.pageVersion++;
    this.moreBusy = false;
    this.emit({
      selected: null,
      rows: [],
      chapters: [],
      paper: null,
      nextCursor: null,
      filters: {},
      loading: false,
      error: "",
    });
  }
  filter(key, value) {
    const filters = { ...this.state.filters, [key]: value };
    if (key === "kind") delete filters.mode;
    this.emit({ filters });
    return this.loadPage();
  }
  path(cursor) {
    const query = Object.entries({
      ...this.state.filters,
      ...(cursor ? { cursor } : {}),
    })
      .filter(([, v]) => v)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return `/test-series/${encodeURIComponent(this.state.selected.id)}/tests?${query}`;
  }
  async loadPage() {
    if (!this.state.selected) return;
    const version = ++this.pageVersion,
      path = this.path();
    this.moreBusy = false;
    this.emit({
      loading: true,
      error: "",
      rows: [],
      nextCursor: null,
      chapters: [],
      paper: null,
    });
    try {
      const d = await this.api(path);
      if (!this.alive || version !== this.pageVersion) return;
      this.emit({
        rows: d.rows,
        nextCursor: d.nextCursor,
        chapters: d.chapters || [],
        paper: d.paper || null,
      });
    } catch (e) {
      if (version === this.pageVersion) this.emit({ error: e.message });
    } finally {
      if (version === this.pageVersion) this.emit({ loading: false });
    }
  }
  async more() {
    if (!this.state.nextCursor || this.moreBusy || this.state.loading) return;
    this.moreBusy = true;
    const version = this.pageVersion,
      path = this.path(this.state.nextCursor);
    this.emit({ loading: true, error: "" });
    try {
      const d = await this.api(path);
      if (!this.alive || version !== this.pageVersion) return;
      const known = new Set(this.state.rows.map((r) => r.id));
      this.emit({
        rows: [...this.state.rows, ...d.rows.filter((r) => !known.has(r.id))],
        nextCursor: d.nextCursor,
      });
    } catch (e) {
      if (version === this.pageVersion) this.emit({ error: e.message });
    } finally {
      if (version === this.pageVersion) {
        this.moreBusy = false;
        this.emit({ loading: false });
      }
    }
  }
  async start(test, navigate) {
    if (this.startBusy || !this.alive) return;
    if (test.activeAttemptId) {
      this.startBusy = true;
      this.emit({ busy: true, error: "" });
      try {
        navigate(`/exam/${test.activeAttemptId}`);
      } catch (e) {
        this.startBusy = false;
        this.emit({ busy: false, error: e.message });
      }
      return;
    }
    this.startBusy = true;
    this.emit({ busy: true, error: "" });
    try {
      const attempt = await this.api(`/tests/${test.id}/start`, {});
      if (this.alive) navigate(`/exam/${attempt.id}`);
    } catch (e) {
      this.emit({ error: e.message });
    } finally {
      this.startBusy = false;
      this.emit({ busy: false });
    }
  }
}
