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

		const helperLists =
					apiGetHelperLists.data?.helper_lists || [];

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

			if (existing?.authenticated !== true) {
				showAlert("Unable to check existing items.", "error");
				return false;
			}

			const duplicate = (existing.helper_items || []).some(
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
				addedItem?.authenticated !== true ||
				!addedItem.helper_item_id
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
					String(addedItem.helper_item_id)
				);
			} else {
				const refreshed = await apiGetHelperItems.run({
					list_id: listId
				});

				if (refreshed?.authenticated !== true) {
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
				console.error("Add helper item failed:", error);
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
					(apiGetHelperItems.data?.helper_items || []).some(
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
				result?.authenticated !== true ||
				Number(result.helper_item_id) !== oldId
			) {
				showAlert("Unable to rename item", "error");
				return false;
			}

			const refreshed = await apiGetHelperItems.run({
				list_id: selListsType.selectedOptionValue
			});

			if (refreshed?.authenticated !== true) {
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
			console.error("Rename helper item failed:", error);
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
				result?.authenticated !== true ||
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
			console.error("Helper impact check failed:", error);
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

		try {
			const result = await apiReplaceDeleteHelperItem.run({
				helper_item_id: params.helper_item_id,
				replace_with_id: params.replace_with_id,
				delete_original: params.delete_original
			});

			if (
				result?.authenticated !== true ||
				!["replace", "replace_delete", "delete"]
				.includes(result.action)
			) {
				showAlert(
					"Unable to complete Replace/Delete.",
					"error"
				);
				return false;
			}

			const refreshed = await apiGetHelperItems.run({
				list_id: selListsType.selectedOptionValue
			});

			if (refreshed?.authenticated !== true) {
				showAlert(
					"Action completed, but the list could not refresh.",
					"warning"
				);
				return false;
			}

			closeModal(mdlPLReplace.name);

			const message =
						result.action === "replace"
			? "Item replaced everywhere used."
			: result.action === "replace_delete"
			? "Item replaced everywhere used and deleted."
			: "Item deleted.";

			showAlert(message, "success");
			return true;

		} catch (error) {
			const message = String(error?.message || error || "");

			if (message.includes("409")) {
				showAlert(
					"Replacement conflicts with existing records. No changes were made.",
					"warning"
				);
			} else {
				console.error("Replace/Delete failed:", error);
				showAlert(
					"Unable to complete Replace/Delete.",
					"error"
				);
			}

			return false;
		}
	}
};
