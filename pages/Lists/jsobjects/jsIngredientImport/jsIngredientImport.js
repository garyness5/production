export default {
	async loadFile() {
		const file =
					filImportListPriceList.files?.[0];

		if (!file?.data) {
			showAlert(
				"Please choose an Excel file.",
				"warning"
			);
			return false;
		}

		try {

			const workbook = XLSX.read(
				file.data,
				{
					type: "binary"
				}
			);

			if (!workbook.SheetNames?.length) {
				showAlert(
					"No worksheets were found in this file.",
					"error"
				);
				return false;
			}

			const sheetName =
						workbook.SheetNames[0];

			const sheet =
						workbook.Sheets[sheetName];

			const sourceRows =
						XLSX.utils.sheet_to_json(
							sheet,
							{
								defval: null
							}
						);

			if (!sourceRows.length) {
				showAlert(
					"No data rows were found in this file.",
					"warning"
				);
				return false;
			}

			const sourceHeaders =
						Object.keys(sourceRows[0]);

			const headerSignature =
						sourceHeaders
			.map(header =>
					 String(header || "")
					 .trim()
					 .toLowerCase()
					)
			.join("|");

			const headerMapRows =
						sourceHeaders.map(
							(header, index) => ({
								id: `hdr_${index + 1}`,
								imported_data: header,
								map_to: this.suggestHeaderMap(header)
							})
						);

			await storeValue(
				"impSourceHeaders",
				sourceHeaders
			);

			await storeValue(
				"impSourceRows",
				sourceRows
			);

			await storeValue(
				"impHeaderSignature",
				headerSignature
			);

			await storeValue(
				"impHeaderMapRows",
				headerMapRows
			);

			await removeValue(
				"impAppliedHeaderMapRows"
			);

			await removeValue(
				"impAppliedHeaderSignature"
			);

			await removeValue(
				"impValueMapRows"
			);

			await removeValue(
				"impImpact"
			);

			/*
		 * If Supplier / No Supplier was already selected
		 * before Load File, immediately re-evaluate the
		 * saved mapping profile for this exact header
		 * signature.
		 */
			if (selImportListSupplier.selectedOptionValue) {
				await this.supplierChanged();
			}

			return true;

		} catch (error) {

			return jsUserErrors.show(
				error,
				"Ingredient file could not be loaded."
			);
		}
	},

	suggestHeaderMap(header) {
		const key =
					String(header || "")
		.trim()
		.toLowerCase();

		const matches = {
			"code": "item_number",
			"item code": "item_number",
			"item number": "item_number",
			"sku": "item_number",

			"category": "category",

			"ingredient": "ingredient",
			"ingredient name": "ingredient",
			"description": "ingredient",
			"item description": "ingredient",

			"qty": "qty",
			"quantity": "qty",

			"unit": "unit",
			"uom": "unit",

			"cost": "cost",
			"price": "cost",
			"case price": "cost"
		};

		return matches[key] || "";
	},

	async applyHeaderMapping() {
		const rows =
					appsmith.store.impHeaderMapRows || [];

		const hasIngredient =
					rows.some(
						row =>
						row.map_to === "ingredient"
					);

		if (!hasIngredient) {
			showAlert(
				"Map one source column to Ingredient before continuing.",
				"warning"
			);
			return false;
		}

		await storeValue(
			"impAppliedHeaderMapRows",
			rows
		);

		await storeValue(
			"impAppliedHeaderSignature",
			appsmith.store.impHeaderSignature || ""
		);

		resetWidget("tblImportMapHeaders", true);

		await removeValue(
			"impValueMapRows"
		);

		await removeValue(
			"impImpact"
		);

		if (appsmith.store.impSelectedSupplierId) {
			await this.rebuildValueMappings();
		}

		return true;
	},

	suggestValueMap(type, value) {
		const normalise = input =>
		String(input || "")
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

		if (type === "Category") {
			const match =
						(apiImpGetLookups.data?.categories || []).find(
							row =>
							normalise(row.name) === normalise(value)
						);

			return match ? `CAT:${match.id}` : "";
		}

		if (type === "Unit") {
			const match =
						(apiImpGetLookups.data?.units || []).find(
							row =>
							normalise(row.abbreviation) === normalise(value)
						);

			return match ? `UNIT:${match.id}` : "";
		}

		return "";
	},

	buildValueMapRows() {
		const sourceRows =
					appsmith.store.impSourceRows || [];

		const headerRows =
					appsmith.store.impAppliedHeaderMapRows || [];

		const sourceFor = target =>
		headerRows.find(
			row => row.map_to === target
		)?.imported_data || "";

		const categoryHeader =
					sourceFor("category");

		const unitHeader =
					sourceFor("unit");

		const uniqueValues = (header, type) => {
			if (!header) return [];

			const seen = new Set();

			return sourceRows.reduce((result, row) => {
				const display =
							String(row?.[header] ?? "").trim();

				if (!display) return result;

				const key =
							display
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.toLowerCase();

				if (seen.has(key)) return result;

				seen.add(key);

				result.push({
					list_id: `${type}:${key}`,
					type: type,
					imported_data: display,
					map_to: this.suggestValueMap(
						type,
						display
					)
				});

				return result;
			}, []);
		};

		return [
			...uniqueValues(categoryHeader, "Category"),
			...uniqueValues(unitHeader, "Unit")
		];
	},

	async rebuildValueMappings() {
		if (!await jsAuthSession.requireValid()) {
			return false;
		}

		try {
			const [lookups, savedMappings] = await Promise.all([
				apiImpGetLookups.run(),
				apiImpGetSavedMappings.run()
			]);

			if (
				lookups?.authenticated !== true ||
				savedMappings?.authenticated !== true
			) {
				showAlert(
					"Unable to load Import mappings. Please try again.",
					"error"
				);
				return false;
			}

			const rows = this.buildValueMapRows();
			const mappedRows = this.applySavedValueMappings(rows);

			await storeValue("impValueMapRows", mappedRows);

			if (mappedRows.length > 0) {
				await storeValue("accImportMapItems", true);
			}

			return true;

		} catch (error) {
			console.error("Import mapping rebuild failed:", error);

			showAlert(
				"Unable to load Import mappings. Please try again.",
				"error"
			);

			return false;
		}
	},

	async supplierChanged() {
		const supplierValue =
					selImportListSupplier.selectedOptionValue || "";

		const currentSignature =
					appsmith.store.impHeaderSignature || "";

		const editableRows =
					appsmith.store.impHeaderMapRows || [];

		const appliedRows =
					appsmith.store.impAppliedHeaderMapRows || [];

		const appliedSignature =
					appsmith.store.impAppliedHeaderSignature || "";

		const hadCleanAppliedHeaders =
					!!currentSignature &&
					appliedSignature === currentSignature &&
					appliedRows.length > 0 &&
					!this.isHeaderMappingDirty(editableRows);

		await storeValue(
			"impSelectedSupplierId",
			supplierValue
		);

		await removeValue("impValueMapRows");
		await removeValue("impImpact");

		/*
     * Blank means no Supplier context selected yet.
     *
     * Do not destroy an already-applied Header Mapping.
     * Header Mapping is independent Working State.
     */
		if (!supplierValue) {
			return true;
		}

		/*
     * No file/header structure yet.
     * Supplier selection is context only.
     */
		if (!currentSignature || !editableRows.length) {
			return true;
		}

		/*
     * Look for a previously committed Header profile for:
     *
     * Client + Supplier/No Supplier + exact header signature
     */
		if (!await jsAuthSession.requireValid()) {
			return false;
		}

		const response = await apiImpGetSavedMappings.run();

		if (response?.authenticated !== true) {
			showAlert(
				"Unable to load saved Import mappings.",
				"error"
			);
			return false;
		}

		const savedRows = response?.mappings || [];

		const savedHeaderRows =
					(savedRows || []).filter(
						row => row.mapping_scope === "header"
					);

		/*
     * Returning Supplier / No Supplier with a matching
     * committed Header profile.
     */
		if (savedHeaderRows.length) {
			const normalizeHeader = value =>
			String(value || "")
			.trim()
			.toLowerCase();

			const savedBySource = {};

			savedHeaderRows.forEach(row => {
				savedBySource[
					normalizeHeader(row.source_value)
				] =
					row.target_value ||
					row.mapping_type ||
					"";
			});

			const restoredRows =
						editableRows.map(row => ({
							...row,
							map_to:
							savedBySource[
								normalizeHeader(row.imported_data)
							] || ""
						}));

			const hasIngredient =
						restoredRows.some(
							row => row.map_to === "ingredient"
						);

			if (!hasIngredient) {
				showAlert(
					"The saved Header Mapping is invalid because Ingredient is not mapped.",
					"warning"
				);
				return false;
			}

			await storeValue(
				"impHeaderMapRows",
				restoredRows
			);

			await storeValue(
				"impAppliedHeaderMapRows",
				restoredRows
			);

			await storeValue(
				"impAppliedHeaderSignature",
				currentSignature
			);

			await this.rebuildValueMappings();

			return true;
		}

		/*
     * No saved Header profile for this Supplier/context.
     *
     * If the current Header Mapping had already been
     * cleanly applied before Supplier selection, keep it
     * and simply rebuild Category/Unit mappings for the
     * newly selected context.
     */
		if (hadCleanAppliedHeaders) {
			await this.rebuildValueMappings();
			return true;
		}

		/*
     * First-time/unknown Supplier structure, or Headers
     * are currently dirty.
     *
     * Leave Header Mapping visible for review.
     * User must Apply Headers before Items are built.
     */
		return true;
	},

	getValueMapOptions(type = "") {
		if (type === "Category") {
			return [
				{ label: "", value: "" },
				{
					label: "# Add New Category",
					value: "__ADD_NEW_CATEGORY__"
				},
				...(apiImpGetLookups.data?.categories || []).map(row => ({
					label: row.name,
					value: `CAT:${row.id}`
				}))
			];
		}

		if (type === "Unit") {
			return [
				{ label: "", value: "" },
				...(apiImpGetLookups.data?.units || []).map(row => ({
					label: `${row.abbreviation} (${row.name})`,
					value: `UNIT:${row.id}`
				}))
			];
		}

		return [];
	},

	async updateHeaderMapping(rowId, selectedValue) {
		const rows =
					appsmith.store.impHeaderMapRows || [];

		const updatedRows =
					rows.map(row => {
						if (row.id === rowId) {
							return {
								...row,
								map_to: selectedValue || ""
							};
						}

						if (
							selectedValue &&
							row.map_to === selectedValue
						) {
							return {
								...row,
								map_to: ""
							};
						}

						return row;
					});

		await storeValue(
			"impHeaderMapRows",
			updatedRows
		);

		if (this.isHeaderMappingDirty(updatedRows)) {
			await removeValue("impValueMapRows");
			await removeValue("impImpact");
		}

		return true;
	},

	async updateValueMapping(rowId, selectedValue) {
		const rows =
					appsmith.store.impValueMapRows || [];

		const updatedRows =
					rows.map(row =>
									 row.list_id === rowId
									 ? {
						...row,
						map_to: selectedValue || ""
					}
									 : row
									);

		await storeValue(
			"impValueMapRows",
			updatedRows
		);

		await removeValue("impImpact");

		return true;
	},

	isHeaderMappingDirty(rows = null) {
		const editable =
					rows ||
					appsmith.store.impHeaderMapRows ||
					[];

		const applied =
					appsmith.store.impAppliedHeaderMapRows ||
					[];

		if (editable.length !== applied.length) {
			return true;
		}

		return editable.some(row => {
			const appliedRow =
						applied.find(
							saved => saved.id === row.id
						);

			return (
				!appliedRow ||
				appliedRow.map_to !== row.map_to
			);
		});
	},

	applySavedValueMappings(rows = []) {
		const savedRows =
					apiImpGetSavedMappings.data?.mappings || [];

		const normalise = value =>
		String(value || "")
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

		return rows.map(row => {
			const match = savedRows.find(saved =>
																	 saved.mapping_scope === "value" &&
																	 normalise(saved.mapping_type) ===
																	 normalise(row.type) &&
																	 normalise(saved.source_value) ===
																	 normalise(row.imported_data)
																	);

			if (!match || !match.target_id) {
				return row;
			}

			return {
				...row,
				map_to:
				row.type === "Category"
				? `CAT:${match.target_id}`
				: `UNIT:${match.target_id}`
			};
		});
	},

	buildMappedImportRows() {
		const sourceRows =
					appsmith.store.impSourceRows || [];

		const headerRows =
					appsmith.store.impAppliedHeaderMapRows || [];

		const valueRows =
					appsmith.store.impValueMapRows || [];

		const sourceHeaderFor = target =>
		headerRows.find(
			row => row.map_to === target
		)?.imported_data || "";

		const codeHeader =
					sourceHeaderFor("item_number");

		const categoryHeader =
					sourceHeaderFor("category");

		const ingredientHeader =
					sourceHeaderFor("ingredient");

		const qtyHeader =
					sourceHeaderFor("qty");

		const unitHeader =
					sourceHeaderFor("unit");

		const costHeader =
					sourceHeaderFor("cost");

		const normalise = value =>
		String(value || "")
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

		const valueMap = (type, value) => {
			const match =
						valueRows.find(
							row =>
							row.type === type &&
							normalise(row.imported_data) ===
							normalise(value)
						);

			return match?.map_to || "";
		};

		return sourceRows.map(row => {
			const categorySource =
						categoryHeader
			? row[categoryHeader]
			: "";

			const unitSource =
						unitHeader
			? row[unitHeader]
			: "";

			const categoryMap =
						valueMap(
							"Category",
							categorySource
						);

			const unitMap =
						valueMap(
							"Unit",
							unitSource
						);

			return {
				item_number:
				codeHeader
				? String(row[codeHeader] ?? "").trim()
				: "",

				category_source:
				String(categorySource ?? "").trim(),

				category_id:
				categoryMap.startsWith("CAT:")
				? Number(categoryMap.substring(4))
				: null,

				add_category:
				categoryMap === "__ADD_NEW_CATEGORY__",

				ingredient:
				ingredientHeader
				? String(row[ingredientHeader] ?? "").trim()
				: "",

				qty:
				qtyHeader
				? row[qtyHeader]
				: null,

				unit_source:
				String(unitSource ?? "").trim(),

				unit_id:
				unitMap.startsWith("UNIT:")
				? Number(unitMap.substring(5))
				: null,

				cost:
				costHeader
				? row[costHeader]
				: null
			};
		});
	},

	previewMappedRows() {
		return this.buildMappedImportRows();
	},

	buildImportImpact() {
		const rows = this.buildMappedImportRows();

		const existingIngredients =
					apiImpGetReview.data?.ingredients || [];

		const units =
					apiImpGetLookups.data?.units || [];

		const normalise = value =>
		String(value || "")
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

		const existingByName = new Map();

		existingIngredients.forEach(item => {
			const key = normalise(item.name);

			if (!existingByName.has(key)) {
				existingByName.set(key, []);
			}

			existingByName.get(key).push(item);
		});

		const finalRowsByName = new Map();

		let duplicateNames = 0;
		let missingIngredientName = 0;

		rows.forEach(row => {
			const name = String(row.ingredient || "").trim();

			if (!name) {
				missingIngredientName++;
				return;
			}

			const key = normalise(name);

			if (finalRowsByName.has(key)) {
				duplicateNames++;
			}

			// Last occurrence of the name wins.
			finalRowsByName.set(key, row);
		});

		let newIngredients = 0;
		let updatedIngredients = 0;
		let missingIngredientCategory = 0;
		let unmappedUnits = 0;
		let unitTypeConflicts = 0;
		let existingNameConflicts = 0;

		finalRowsByName.forEach((row, key) => {
			const matches = existingByName.get(key) || [];

			if (matches.length === 0) {
				newIngredients++;
			} else if (matches.length === 1) {
				updatedIngredients++;

				const existing = matches[0];

				const importedUnit = units.find(unit =>
																				Number(unit.id) === Number(row.unit_id)
																			 );

				if (
					existing.purchase_unit_type &&
					importedUnit?.unit_type &&
					existing.purchase_unit_type !==
					importedUnit.unit_type &&
					Number(existing.downstream_count || 0) > 0
				) {
					unitTypeConflicts++;
				}
			} else {
				existingNameConflicts++;
			}

			if (!row.category_id && !row.add_category) {
				missingIngredientCategory++;
			}

			if (row.unit_source && !row.unit_id) {
				unmappedUnits++;
			}
		});

		return {
			totalIngredients: rows.length,
			newIngredients,
			updatedIngredients,
			duplicateNames,
			missingIngredientCategory,
			unmappedUnits,
			missingIngredientName,
			unitTypeConflicts,
			existingNameConflicts
		};
	},

	async reviewImport() {
		if (!await jsAuthSession.requireValid()) {
			return false;
		}

		try {
			const reviewResult = await apiImpGetReview.run();

			if (reviewResult?.authenticated !== true) {
				showAlert(
					"Unable to complete Import Review. Please try again.",
					"error"
				);
				return false;
			}

			const clone = value =>
			JSON.parse(JSON.stringify(value));

			const mappedRows =
						this.buildMappedImportRows();

			const impact =
						this.buildImportImpact();

			const snapshot = {
				supplier_id:
				appsmith.store.impSelectedSupplierId || "",

				header_signature:
				appsmith.store.impAppliedHeaderSignature || "",

				header_mappings:
				clone(
					appsmith.store.impAppliedHeaderMapRows || []
				),

				value_mappings:
				clone(
					appsmith.store.impValueMapRows || []
				),

				rows:
				clone(mappedRows),

				impact:
				clone(impact)
			};

			await storeValue(
				"impReviewSnapshot",
				snapshot
			);

			await storeValue(
				"impImpact",
				impact
			);

			showModal(mdlImportConfirm.name);

			return true;

		} catch (error) {
			console.error("Lists Import Review failed:", error);

			showAlert(
				"Unable to complete Import Review. Please try again.",
				"error"
			);

			return false;
		}
	},

	async clearImportWorkspace() {
		await removeValue("impSourceHeaders");
		await removeValue("impSourceRows");
		await removeValue("impHeaderSignature");

		await removeValue("impHeaderMapRows");
		await removeValue("impAppliedHeaderMapRows");
		await removeValue("impAppliedHeaderSignature");

		await removeValue("impSelectedSupplierId");

		await removeValue("impValueMapRows");

		await removeValue("impReviewSnapshot");
		await removeValue("impImpact");

		resetWidget("filImportListPriceList", true);
		resetWidget("selImportListSupplier", true);

		closeModal(mdlImportConfirm.name);

		return true;
	},

	async discardImport() {
		await this.clearImportWorkspace();

		showAlert(
			"Import session discarded.",
			"success"
		);

		return true;
	},

	async confirmImport() {
		if (!await jsAuthSession.requireValid()) {
			return false;
		}

		const snapshot = appsmith.store.impReviewSnapshot;

		if (!snapshot) {
			showAlert(
				"Import review is no longer available. Please review the import again.",
				"warning"
			);
			return false;
		}

		try {
			const response = await apiImpCommit.run();

			if (
				response?.authenticated !== true ||
				response?.result == null
			) {
				throw new Error(
					response?.error || "Ingredient Import commit failed."
				);
			}

			await this.clearImportWorkspace();

			showAlert(
				"Ingredients imported successfully.",
				"success"
			);

			return true;

		} catch (error) {
			jsUserErrors.show(error, "Ingredient Import");
			return false;
		}
	},

	importConfirmQuestion() {
		const snapshot =
					appsmith.store.impReviewSnapshot;

		if (!snapshot) {
			return "Do you want to import these Ingredients?";
		}

		const count =
					(snapshot.rows || []).length;

		const supplier =
					snapshot.no_supplier
		? "No Supplier"
		: (
			selImportListSupplier.selectedOptionLabel ||
			"Supplier"
		);

		return `Do you want to import ${count} Ingredients to ${supplier}?`;
	},
};