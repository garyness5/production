export default {
	selectedMenuId() {
		return Number(tblMnuList.selectedRow?.id || 0);
	},

	hasSelection() {
		return this.selectedMenuId() > 0;
	},

	async openSelectedMenu() {
		if (!this.hasSelection()) {
			showAlert(
				"Select a menu first.",
				"warning"
			);

			return false;
		}

		await storeValue(
			"current_menu_id",
			this.selectedMenuId()
		);

		await storeValue(
			"Menu_open_mode",
			"edit"
		);

		await storeValue(
			"Menu_mode",
			"edit"
		);

		navigateTo("Menu");

		return true;
	},

	async addMenu() {
		await removeValue(
			"current_menu_id"
		);

		await storeValue(
			"Menu_open_mode",
			"add"
		);

		await storeValue(
			"Menu_mode",
			"add"
		);

		navigateTo("Menu");

		return true;
	},

	async duplicateSelectedMenu() {
		if (!this.hasSelection()) {
			showAlert(
				"Select a menu first.",
				"warning"
			);

			return false;
		}

		await removeValue(
			"menu_workspace"
		);

		await removeValue(
			"menu_baseline"
		);

		await removeValue(
			"mnu_components_local_rows"
		);

		await removeValue(
			"Menu_open_mode"
		);

		await storeValue(
			"current_menu_id",
			this.selectedMenuId()
		);

		await storeValue(
			"Menu_mode",
			"duplicate"
		);

		navigateTo(
			"Menu",
			{},
			"SAME_WINDOW"
		);

		return true;
	},

	async deleteSelectedMenuStart() {
		if (!this.hasSelection()) {
			showAlert(
				"Select a menu first.",
				"warning"
			);
			return false;
		}

		showModal(mdlMnuDelete.name);

		return true;
	},

	async deleteSelectedMenuConfirm() {
		if (!this.hasSelection()) {
			showAlert("Select a menu first.", "warning");
			return false;
		}

		await qryMnuLstDeleteMnu.run();

		closeModal(mdlMnuDelete.name);

		await qryMnuLstGetMnuList.run();

		showAlert("Menu deleted.", "success");
		return true;
	},

	impactEventCount() {
		return Number(
			qryMnuLstGetImpactCount.data?.[0]?.event_count || 0
		);
	},

	deleteImpactText() {
		return `This will impact
    Events: ${this.impactEventCount()}`;
	},

	showDeleteImpact() {
		return this.impactEventCount() > 0;
	},

	searchText() {
		return (inpMnuListSearch.text || "")
			.trim()
			.toLowerCase();
	},

	statusFilter() {
		return selMnuListFilter.selectedOptionValue || "all";
	},

	filteredRows() {
		const rows = qryMnuLstGetMnuList.data || [];
		const search = this.searchText();
		const status = this.statusFilter();

		return rows.filter(row => {
			const matchesSearch =
						!search ||
						(row.name || "")
			.toLowerCase()
			.includes(search);

			const matchesStatus =
						status === "all" ||
						(status === "active" && row.active === true) ||
						(status === "inactive" && row.active === false);

			return matchesSearch && matchesStatus;
		});
	},

	async setCategory(menuId, newCategoryId) {
		const id =
					Number(menuId || 0);

		const categoryId =
					Number(newCategoryId || 0) || null;

		if (!id) {
			return false;
		}

		try {
			await qryMnuLstSetCategory.run({
				menu_id: id,
				category_id: categoryId
			});

			await qryMnuLstGetMnuList.run();

			return true;

		} catch (error) {
			showAlert(
				error?.message ||
				"Menu Category could not be changed.",
				"error"
			);

			await qryMnuLstGetMnuList.run();

			return false;
		}
	},

	async setActive(row, active) {
		const menuId =
					Number(row?.id || 0);

		if (!menuId) {
			return false;
		}

		try {
			await qryMnuLstSetActive.run({
				menu_id: menuId,
				active: active === true
			});

			await qryMnuLstGetMnuList.run();

			return true;

		} catch (error) {
			showAlert(
				error?.message ||
				"Menu Active status could not be changed.",
				"error"
			);

			await qryMnuLstGetMnuList.run();

			return false;
		}
	},
}