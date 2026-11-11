export default {
	emptyHeader() {
		return {
			name: null,
			category_id: null,
			active: true,
			yield_qty: null,
			extra_percent: 0,
			notes: null
		};
	},

	emptySnapshot() {
		return {
			header: this.emptyHeader(),
			diet_tags: [],
			components: []
		};
	},

	clean(value) {
		if (
			value === undefined ||
			value === null ||
			value === ""
		) {
			return null;
		}

		if (typeof value === "number") {
			return Number(value);
		}

		if (
			value !== true &&
			value !== false &&
			!isNaN(value)
		) {
			return Number(value);
		}

		return value;
	},

	textClean(value) {
		const text =
					String(
						value || ""
					).trim();

		return text || null;
	},

	normalizeHeader(header) {
		const h =
					header || {};

		return {
			name:
			this.textClean(
				h.name
			),

			category_id:
			this.clean(
				h.category_id
			),

			active:
			h.active === false
			? false
			: true,

			yield_qty:
			this.clean(
				h.yield_qty
			),

			extra_percent:
			this.clean(
				h.extra_percent
			) ?? 0,

			notes:
			this.textClean(
				h.notes
			)
		};
	},

	normalizeDietTags(values) {
		return (
			values || []
		)
			.map(x => {
			if (
				x !== null &&
				typeof x === "object"
			) {
				return (
					x.value ??
					x.helper_list_item_id ??
					x.tag_id ??
					null
				);
			}

			return x;
		})
			.map(Number)
			.filter(Boolean)
			.sort(
			(a, b) =>
			a - b
		);
	},

	normalizeComponents(rows) {
		return (
			rows || []
		)
			.filter(r =>
							r &&
							(
			r.ingredient_id ||
			r.child_recipe_id ||
			r.child_dish_id ||
			r.component_name
		)
						 )
			.map(r => ({
			...r,

			item_type:
			r.item_type ||
			null,

			ingredient_id:
			r.item_type ===
			"ingredient"
			? Number(
				r.ingredient_id ||
				0
			) || null
			: null,

			child_recipe_id:
			r.item_type ===
			"recipe"
			? Number(
				r.child_recipe_id ||
				0
			) || null
			: null,

			child_dish_id:
			r.item_type ===
			"dish"
			? Number(
				r.child_dish_id ||
				0
			) || null
			: null,

			qty:
			r.qty === "" ||
			r.qty == null
			? null
			: Number(
				r.qty
			),

			unit_id:
			r.unit_id == null
			? null
			: Number(
				r.unit_id
			),

			apply_wastage:
			r.apply_wastage !==
			false,

			active:
			r.active !==
			false
		}));
	},

	componentsForCompare(rows) {
		return (
			rows || []
		)
			.map(r => ({
			item_type:
			r.item_type ||
			null,

			ingredient_id:
			r.item_type ===
			"ingredient"
			? Number(
				r.ingredient_id ||
				0
			) || null
			: null,

			child_recipe_id:
			r.item_type ===
			"recipe"
			? Number(
				r.child_recipe_id ||
				0
			) || null
			: null,

			child_dish_id:
			r.item_type ===
			"dish"
			? Number(
				r.child_dish_id ||
				0
			) || null
			: null,

			qty:
			r.qty === "" ||
			r.qty == null
			? null
			: Number(
				r.qty
			),

			unit_id:
			r.unit_id == null
			? null
			: Number(
				r.unit_id
			),

			apply_wastage:
			r.apply_wastage !==
			false,

			active:
			r.active !==
			false
		}));
	},

	normalizeSnapshot(snapshot) {
		const s =
					snapshot || {};

		return {
			header:
			this.normalizeHeader(
				s.header
			),

			diet_tags:
			this.normalizeDietTags(
				s.diet_tags
			),

			components:
			this.normalizeComponents(
				s.components
			)
		};
	},

	baseline() {
		return this.normalizeSnapshot(
			appsmith.store
			.menu_baseline ||
			this.emptySnapshot()
		);
	},

	get() {
		return this.normalizeSnapshot(
			appsmith.store
			.menu_workspace ||
			this.baseline()
		);
	},

	currentHeaderFromPage() {
		return this.normalizeHeader({
			name:
			inpMnuName.text,

			category_id:
			selMnuCategory
			.selectedOptionValue,

			active:
			chkMnuActive
			.isChecked,

			// Current widget name retained temporarily.
			// This field now means Serves.
			yield_qty:
			inpMnuServes.text,

			extra_percent:
			inpMnuExtraPercent.text,

			notes:
			rteMnuNotes.text
		});
	},

	currentDietTagsFromPage() {
		return this.normalizeDietTags(
			msMnuDietTags
			.selectedOptionValues ||
			[]
		);
	},

	currentComponents() {
		return this.normalizeComponents(
			jsMnuCompTable
			.mergeUpdatedRows()
		);
	},

	current() {
		return this.normalizeSnapshot({
			header:
			this.currentHeaderFromPage(),

			diet_tags:
			this.currentDietTagsFromPage(),

			components:
			this.currentComponents()
		});
	},

	async setWorkspace(snapshot) {
		const value =
					this.normalizeSnapshot(
						snapshot
					);

		await storeValue(
			"menu_workspace",
			value
		);

		return value;
	},

	async capture() {
		const value =
					this.current();

		await this.setWorkspace(
			value
		);

		return value;
	},

	savedHeaderFromQuery() {
		const row =
					Array.isArray(
						qryMnuGetItemById.data
					)
		? qryMnuGetItemById.data[0]
		: qryMnuGetItemById.data;

		if (!row) {
			return this.emptyHeader();
		}

		return this.normalizeHeader({
			name:
			row.name,

			category_id:
			row.category_id,

			active:
			row.active,

			yield_qty:
			row.yield_qty,

			extra_percent:
			row.extra_percent,

			notes:
			row.notes
		});
	},

	savedDietTagsFromQuery() {
		return this.normalizeDietTags(
			qryMnuGetSelectedDietTags
			.data ||
			[]
		);
	},

	savedComponentsFromQuery() {
		return this.normalizeComponents(
			qryMnuGetComponents
			.data ||
			[]
		);
	},

	savedTruth() {
		return this.normalizeSnapshot({
			header:
			this.savedHeaderFromQuery(),

			diet_tags:
			this.savedDietTagsFromQuery(),

			components:
			this.savedComponentsFromQuery()
		});
	},

	async setBaseline(snapshot) {
		const value =
					this.normalizeSnapshot(
						snapshot
					);

		await storeValue(
			"menu_baseline",
			value
		);

		return value;
	},

	async initializeFromSaved() {
		const saved =
					this.savedTruth();

		await this.setBaseline(
			saved
		);

		await this.setWorkspace(
			saved
		);

		return saved;
	},

	async initializeNew() {
		const empty =
					this.emptySnapshot();

		await this.setBaseline(
			empty
		);

		await this.setWorkspace(
			empty
		);

		return empty;
	},

	async initializeDuplicate(snapshot) {
		const value =
					this.normalizeSnapshot(
						snapshot
					);

		await this.setBaseline(
			this.emptySnapshot()
		);

		await this.setWorkspace(
			value
		);

		return value;
	},

	isDirty() {
		const current =
					this.current();

		const baseline =
					this.baseline();

		return (
			JSON.stringify({
				header:
				current.header,

				diet_tags:
				current.diet_tags,

				components:
				this.componentsForCompare(
					current.components
				)
			}) !==

			JSON.stringify({
				header:
				baseline.header,

				diet_tags:
				baseline.diet_tags,

				components:
				this.componentsForCompare(
					baseline.components
				)
			})
		);
	},

	async discard() {
		return await this.setWorkspace(
			this.baseline()
		);
	},

	async clear() {
		await removeValue(
			"menu_workspace"
		);

		await removeValue(
			"menu_baseline"
		);

		return true;
	}
};