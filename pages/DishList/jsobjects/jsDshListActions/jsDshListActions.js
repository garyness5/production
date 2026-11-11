export default {
	selectedDishId() {
		return Number(tblDshList.selectedRow?.id || 0);
	},

	hasSelection() {
		return this.selectedDishId() > 0;
	},

	async openSelectedDish() {
		if (!this.hasSelection()) {
			showAlert(
				"Select a dish first.",
				"warning"
			);

			return false;
		}

		await storeValue(
			"current_dish_id",
			this.selectedDishId()
		);

		await storeValue(
			"Dish_mode",
			"edit"
		);

		await removeValue(
			"dsh_components_local_rows"
		);

		navigateTo("Dish");

		return true;
	},

	async addDish() {
		await storeValue(
			"current_dish_id",
			0
		);

		await storeValue(
			"Dish_mode",
			"add"
		);

		await removeValue(
			"dsh_components_local_rows"
		);

		navigateTo("Dish");

		return true;
	},

	async duplicateSelectedDish() {
		if (!this.hasSelection()) {
			showAlert(
				"Select a dish first.",
				"warning"
			);

			return false;
		}

		await removeValue(
			"dish_workspace"
		);

		await removeValue(
			"dish_baseline"
		);

		await removeValue(
			"dsh_components_local_rows"
		);

		await storeValue(
			"current_dish_id",
			this.selectedDishId()
		);

		await storeValue(
			"Dish_mode",
			"duplicate"
		);

		navigateTo(
			"Dish",
			{},
			"SAME_WINDOW"
		);

		return true;
	},

	async deleteSelectedDishStart() {
		if (!this.hasSelection()) {
			showAlert(
				"Select a Dish first.",
				"warning"
			);

			return false;
		}

		await qryDshListGetImpactCount.run();

		showModal(
			mdlDshListDelete.name
		);

		return true;
	},

	async deleteSelectedDishConfirm() {
		const dishId =
					this.selectedDishId();

		if (!dishId) {
			showAlert(
				"Select a Dish first.",
				"warning"
			);

			return false;
		}

		try {
			const result =
						await qryDshListDelete.run({
							dish_id: dishId
						});

			const deletedId =
						Number(result?.[0]?.id || 0);

			if (
				!deletedId ||
				deletedId !== dishId
			) {
				showAlert(
					"Dish was not deleted.",
					"error"
				);

				return false;
			}

			await removeValue(
				"current_dish_id"
			);

			closeModal(
				mdlDshListDelete.name
			);

			await qryDshListGetDishList.run();

			showAlert(
				"Dish deleted.",
				"success"
			);

			return true;

		} catch (error) {
			showAlert(
				error?.message ||
				"Dish could not be deleted.",
				"error"
			);

			return false;
		}
	},

	impactMenuCount() {
		return Number(
			qryDshListGetImpactCount.data?.[0]?.menu_count || 0
		);
	},

	deleteImpactText() {
		return `This will impact
    Menus: ${this.impactMenuCount()}`;
	},

	showDeleteImpact() {
		return this.impactMenuCount() > 0;
	},

	async setCategory(dishId, newCategoryId) {
		const id =
					Number(dishId || 0);

		const categoryId =
					Number(newCategoryId || 0) || null;

		if (!id) {
			return false;
		}

		try {
			await qryDshListSetCategory.run({
				dish_id: id,
				category_id: categoryId
			});

			await qryDshListGetDishList.run();

			return true;

		} catch (error) {
			showAlert(
				error?.message ||
				"Dish Category could not be changed.",
				"error"
			);

			await qryDshListGetDishList.run();

			return false;
		}
	},

	async setActive(row, active) {
		const dishId =
					Number(row?.id || 0);

		if (!dishId) {
			return false;
		}

		try {
			await qryDshListSetActive.run({
				dish_id: dishId,
				active: active === true
			});

			await qryDshListGetDishList.run();

			return true;

		} catch (error) {
			showAlert(
				error?.message ||
				"Dish Active status could not be changed.",
				"error"
			);

			await qryDshListGetDishList.run();

			return false;
		}
	},

	searchText() {
		return (inpDishLstSearch.text || "")
			.trim()
			.toLowerCase();
	},

	statusFilter() {
		return selDshLstFilter.selectedOptionValue || "all";
	},

	filteredRows() {
		const rows = qryDshListGetDishList.data || [];
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
}