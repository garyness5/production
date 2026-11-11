export default {
	listCode() {
		const listId = String(selListsType.selectedOptionValue || "");
		const lists = apiGetHelperLists.data?.helper_lists || [];

		return lists.find(
			item => String(item.id) === listId
		)?.list_code || "";
	},

	impact() {
		return apiGetHelperItemImpact.data?.impact || {};
	},

	ingredientCount() {
		return Number(this.impact().ingredient_count || 0);
	},

	recipeCount() {
		return Number(this.impact().recipe_count || 0);
	},

	dishCount() {
		return Number(this.impact().dish_count || 0);
	},

	menuCount() {
		return Number(this.impact().menu_count || 0);
	},

	eventCount() {
		return Number(this.impact().event_count || 0);
	},

	totalImpactCount() {
		return Number(this.impact().total_count || 0);
	},

	hasSelection() {
		return Number(tblListsItems.selectedRow?.id || 0) > 0;
	},

	isDietTag() {
		return this.listCode() === "diet_tag";
	},

	isCategory() {
		return [
			"ingredient_category",
			"recipe_category",
			"dish_category",
			"menu_category"
		].includes(this.listCode());
	},

	isSystemItem() {
		return tblListsItems.selectedRow?.is_system === true;
	},

	isProtectedSystemItem() {
		return this.isSystemItem();
	},

	canRenameSelected() {
		return this.hasSelection() && !this.isProtectedSystemItem();
	},

	canReplaceDeleteSelected() {
		return this.hasSelection() && !this.isProtectedSystemItem();
	},

	replaceSaveDisabled() {
		const action = radPLReplaceDeleteAction.selectedOptionValue;

		if (!action) return true;

		if (
			action === "replace" &&
			!selPLReplaceWith.selectedOptionValue
		) {
			return true;
		}

		return false;
	},

	replaceWithDisabled() {
		return this.isDietTag();
	},

	replaceActionOptions() {
		if (this.isDietTag()) {
			return [{ label: "Delete", value: "delete" }];
		}

		return [
			{ label: "Replace", value: "replace" },
			{ label: "Delete", value: "delete" }
		];
	},

	replaceActionDefault() {
		return this.isDietTag() ? "delete" : "replace";
	},

	replacementOptions() {
		const selectedId = String(tblListsItems.selectedRow?.id || "");
		const items = apiGetHelperItems.data?.helper_items || [];

		const options = items
		.filter(item => String(item.id) !== selectedId)
		.map(item => ({
			label: String(item.name || ""),
			value: String(item.id)
		}));

		return options.length
			? options
		: [{ label: "", value: "" }];
	},

	deleteMessage() {
		if (this.totalImpactCount() > 0) {
			return "<b>This item is currently being used.</b><br>Review the impact before applying the change.";
		}

		return "<b>This item is not currently being used.</b>";
	}
};
