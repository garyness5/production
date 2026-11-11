export default {
	async openAdd() {
		await resetWidget(
			mdlRecIngAddIng.name,
			true
		);

		showModal(
			mdlRecIngAddIng.name
		);

		return true;
	},

	validate() {
		const name =
					String(
						inpRecIngIngredient.text || ""
					).trim();

		if (!name) {
			showAlert(
				"Ingredient Name is required.",
				"warning"
			);

			return false;
		}

		return true;
	},

	async save(closeAfter = true) {
		if (!this.validate()) {
			return false;
		}

		const optionalId = value => {
			const id = Number(value);
			return Number.isFinite(id) && id > 0 ? id : null;
		};

		const payload = {
			name: String(inpRecIngIngredient.text || "").trim(),

			category_id: optionalId(
				selRecIngCategory.selectedOptionValue
			),

			purchase_unit_id: optionalId(
				selRecIngPurchaseUnit.selectedOptionValue
			),

			purchase_qty: inpRecIngQuantity.text || null,
			total_cost: inpRecIngPurchaseCost.text || null,
			wastage_percent: inpRecIngWastage.text || 0,

			supplier_id: optionalId(
				selRecIngSupplier.selectedOptionValue
			),

			packaging_id: optionalId(
				selRecIngPackaging.selectedOptionValue
			),

			item_code:
			inpRecIngSupplierCode.text?.trim() || null,

			notes: rteRecIngAddRecNotes.text || null,

			active: chkRecIngActive.isChecked !== false,

			allergen_ids:
			(msRecIngAllergens.selectedOptionValues || [])
			.map(Number),

			diet_tag_ids:
			(msRecIngDietTags.selectedOptionValues || [])
			.map(Number)
		};

		if (!(await jsAuthSession.requireValid())) {
			return false;
		}

		try {
			const result = await apiRecSaveIngredient.run({
				ingredient_id: null,
				payload
			});

			const savedId = Number(result?.ingredient_id || 0);

			if (
				result?.authenticated !== true ||
				!savedId
			) {
				throw new Error(
					"Ingredient Save returned an invalid response."
				);
			}

			let refreshSucceeded = false;

			try {
				const refreshed = await apiRecGetComponentItems.run();

				refreshSucceeded =
					refreshed?.authenticated === true &&
					Array.isArray(refreshed.component_items);

			} catch (refreshError) {
				console.error(
					"Ingredient saved; component refresh failed:",
					refreshError
				);
			}

			if (closeAfter) {
				closeModal(mdlRecIngAddIng.name);
			} else {
				await resetWidget(mdlRecIngAddIng.name, true);
			}

			if (refreshSucceeded) {
				showAlert("Ingredient saved.", "success");
			} else {
				showAlert(
					"Ingredient saved, but the Recipe ingredient list could not be refreshed. Reopen Recipe to refresh the list.",
					"warning"
				);
			}

			return true;

		} catch (error) {
			showAlert(
				jsUserErrors.friendly(error),
				"error"
			);

			return false;
		}
	},

	cancel() {
		closeModal(
			mdlRecIngAddIng.name
		);

		return true;
	},

	netYieldText() {
		const qty =
					Number(
						inpRecIngQuantity.text || 0
					);

		if (!qty) {
			return "Net Yield: ";
		}

		const wastage =
					Number(
						inpRecIngWastage.text || 0
					);

		const netYield =
					qty * (1 - wastage / 100);

		return `Net Yield: ${netYield.toFixed(2)}`;
	},

	costPerUnitText() {
		const qty =
					Number(
						inpRecIngQuantity.text || 0
					);

		const cost =
					Number(
						inpRecIngPurchaseCost.text || 0
					);

		if (!qty || !cost) {
			return "Cost / unit ";
		}

		const wastage =
					Number(
						inpRecIngWastage.text || 0
					);

		const netYield =
					qty * (1 - wastage / 100);

		if (!netYield || netYield <= 0) {
			return "Cost / unit ";
		}

		const value =
					cost / netYield;

		const price =
					value % 1 === 0
		? value.toFixed(0)
		: value.toFixed(2);

		const unit =
					selRecIngPurchaseUnit.selectedOptionLabel || "";

		return unit
			? `Cost / unit $${price} / ${unit}`
		: `Cost / unit $${price}`;
	},
};