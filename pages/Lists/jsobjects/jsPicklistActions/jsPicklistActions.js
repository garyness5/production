export default {
	norm(value) {
		return String(value || "")
			.trim()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase();
	},

	async openAdd() {
		resetWidget("inpPLAddName");
		showModal(mdlPLAdd.name);
		return true;
	},


	async saveAdd() {
		const newName = (inpPLAddName.text || "").trim();

		if (!newName) return false;

		const fromImport =
					appsmith.store.plAddContext === "ingredientImport";

		const helperLists = apiGetHelperLists.data?.lists || [];

		let listId;

		if (fromImport) {
			const supplierList = helperLists.find(
				x => x.list_code === "supplier"
			);

			if (!supplierList) {
				showAlert("Supplier list could not be found.", "error");
				return false;
			}

			listId = supplierList.id;
		} else {
			listId = selListsType.selectedOptionValue;
		}

		if (!listId) {
			showAlert("Select a list first.", "warning");
			return false;
		}

		if (!await jsAuthSession.requireValid()) {
			return false;
		}

		try {
			const existing = await apiGetHelperItems.run({
				list_id: listId
			});

			if (existing?.ok !== true) {
				showAlert("Unable to check existing items.", "error");
				return false;
			}

			const duplicate = (existing.items || []).some(
				item => this.norm(item.name) === this.norm(newName)
			);

			if (duplicate) {
				showAlert(
					"Name already exists in this list.",
					"warning"
				);
				return false;
			}

			const addedItem = await apiAddHelperItem.run({
				list_id: listId,
				name: newName
			});

			if (
				addedItem?.ok !== true ||
				!addedItem?.item?.id
			) {
				throw new Error(JSON.stringify(addedItem || {}));
			}

			if (fromImport) {
				const suppliers = await apiImpGetSuppliers.run();

				if (suppliers?.authenticated !== true) {
					throw new Error("Supplier refresh failed.");
				}

				await storeValue(
					"impSelectedSupplierId",
					String(addedItem.item.id)
				);
			} else {
				const refreshed = await apiGetHelperItems.run({
					list_id: listId
				});

				if (refreshed?.ok !== true) {
					throw new Error("Helper list refresh failed.");
				}
			}

			resetWidget("inpPLAddName");
			closeModal(mdlPLAdd.name);

			showAlert("Item added.", "success");
			return true;

		} catch (error) {
			const message = String(error?.message || error || "");

			if (
				message.includes("409") ||
				message.toLowerCase().includes("already exists") ||
				message.toLowerCase().includes("duplicate")
			) {
				showAlert(
					"Name already exists in this list.",
					"warning"
				);
			} else {
				showAlert("Unable to add item.", "error");
			}

			return false;
		}
	},


	async openRename() {
		if (!jsPicklistRules.hasSelection()) {
			showAlert("Select an item first.", "warning");
			return false;
		}

		if (jsPicklistRules.isProtectedSystemItem()) {
			return false;
		}

		resetWidget("inpPLRenameName");
		showModal(mdlPLRename.name);
		return true;
	},


	async saveRename() {
		const newName = (inpPLRenameName.text || "").trim();

		const oldId = Number(
			tblListsItems.selectedRow?.id || 0
		);

		if (!newName || !oldId) return false;

		const exists =
					(apiGetHelperItems.data?.items || []).some(
						item =>
						Number(item.id) !== oldId &&
						this.norm(item.name) === this.norm(newName)
					);

		if (exists) {
			showAlert(
				"Name already exists in this list",
				"warning"
			);
			return false;
		}

		if (!await jsAuthSession.requireValid()) {
			return false;
		}

		try {
			const result = await apiRenameHelperItem.run({
				helper_item_id: oldId,
				name: newName
			});

			if (
				result?.ok !== true ||
				Number(result?.item?.id) !== oldId
			) {
				showAlert("Unable to rename item", "error");
				return false;
			}

			const refreshed = await apiGetHelperItems.run({
				list_id: selListsType.selectedOptionValue
			});

			if (refreshed?.ok !== true) {
				showAlert(
					"Item renamed, but the list could not refresh.",
					"warning"
				);
				return false;
			}

			closeModal(mdlPLRename.name);
			showAlert("Item renamed", "success");
			return true;

		} catch (error) {
			showAlert(
				"Unable to rename item. Check whether the name already exists.",
				"error"
			);
			return false;
		}
	},


	async openReplaceDelete() {
		if (!jsPicklistRules.hasSelection()) {
			showAlert("Select an item first.", "warning");
			return false;
		}

		if (jsPicklistRules.isProtectedSystemItem()) {
			return false;
		}

		if (!await jsAuthSession.requireValid()) {
			return false;
		}

		try {
			const result = await apiGetHelperItemImpact.run({
				helper_item_id: Number(tblListsItems.selectedRow.id)
			});

			if (
				result?.ok !== true ||
				!result?.impact
			) {
				showAlert("Unable to check item usage.", "error");
				return false;
			}

			resetWidget("radPLReplaceDeleteAction");
			resetWidget("selPLReplaceWith");

			showModal(mdlPLReplace.name);
			return true;

		} catch (error) {
			showAlert("Unable to check item usage.", "error");
			return false;
		}
	},

	onReplaceDeleteActionChange() {
		return true;
	},

	async saveReplaceDelete() {
		if (!jsPicklistRules.hasSelection()) {
			showAlert("Select an item first.", "warning");
			return false;
		}

		if (jsPicklistRules.isProtectedSystemItem()) {
			return false;
		}

		const action = jsPicklistRules.isDietTag()
		? "delete"
		: radPLReplaceDeleteAction.selectedOptionValue;

		const replaceToId = jsPicklistRules.isDietTag()
		? null
		: (selPLReplaceWith.selectedOptionValue || null);

		if (!action || !["replace", "delete"].includes(action)) {
			showAlert("Select an action first.", "warning");
			return false;
		}

		if (action === "replace" && !replaceToId) {
			showAlert(
				"Select a replacement item first.",
				"warning"
			);
			return false;
		}

		const sourceId = tblListsItems.selectedRow?.id;

		if (!sourceId) {
			showAlert("Select an item first.", "warning");
			return false;
		}

		if (
			replaceToId &&
			String(replaceToId) === String(sourceId)
		) {
			showAlert(
				"Select a different replacement item.",
				"warning"
			);
			return false;
		}

		return await this.confirmReplaceDelete({
			helper_item_id: String(sourceId),
			replace_with_id: replaceToId
			? String(replaceToId)
			: null,
			delete_original: action === "delete"
		});
	},



	async confirmReplaceDelete(params) {
		if (!params?.helper_item_id) {
			showAlert("Invalid Replace/Delete request.", "error");
			return false;
		}

		if (!await jsAuthSession.requireValid()) {
			return false;
		}

		const sourceId = Number(params.helper_item_id);
		const targetId = params.replace_with_id
		? Number(params.replace_with_id)
		: null;

		try {
			let result;
			let message;

			if (params.delete_original === false) {
				if (!targetId || targetId === sourceId) {
					showAlert(
						"Select a different replacement item.",
						"warning"
					);
					return false;
				}

				result = await apiReplaceHelperItem.run({
					source_id: sourceId,
					target_id: targetId
				});

				message = "Item replaced everywhere used.";

			} else if (params.delete_original === true) {
				if (targetId) {
					if (targetId === sourceId) {
						showAlert(
							"Select a different replacement item.",
							"warning"
						);
						return false;
					}

					result = await apiReplaceDeleteHelperItem.run({
						source_id: sourceId,
						target_id: targetId
					});

					message =
						"Item replaced everywhere used and deleted.";

				} else {
					result = await apiDeleteHelperItem.run({
						item_id: sourceId
					});

					message = "Item deleted.";
				}

			} else {
				showAlert(
					"Invalid Replace/Delete request.",
					"error"
				);
				return false;
			}

			if (result?.ok !== true) {
				showAlert(
					"Unable to complete Replace/Delete.",
					"error"
				);
				return false;
			}

			const refreshed = await apiGetHelperItems.run({
				list_id: selListsType.selectedOptionValue
			});

			if (refreshed?.ok !== true) {
				showAlert(
					"Action completed, but the list could not refresh.",
					"warning"
				);
				return false;
			}

			closeModal(mdlPLReplace.name);
			showAlert(message, "success");
			return true;

		} catch (error) {
			const errorMessage =
						String(error?.message || error || "");

			if (errorMessage.includes("409")) {
				showAlert(
					"Replacement conflicts with existing records. No changes were made.",
					"warning"
				);
			} else {
				showAlert(
					"Unable to complete Replace/Delete.",
					"error"
				);
			}

			return false;
		}
	},
};
