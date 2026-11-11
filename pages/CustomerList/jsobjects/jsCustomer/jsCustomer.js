export default {
	async save(closeAfter = true, bypassDuplicate = false) {
		const customerName = (inpCustomerName.text || "").trim();
		const customerId = Number(
			appsmith.store.current_customer_id || 0
		);

		if (!customerName) {
			showAlert("Customer name is required.", "warning");
			return;
		}

		const originalName = (
			appsmith.store.original_customer_name || ""
		).trim();

		const nameChanged =
					customerName.toLowerCase() !==
					originalName.toLowerCase();

		const mustCheckDuplicate =
					!bypassDuplicate &&
					(!customerId || nameChanged);

		try {
			if (mustCheckDuplicate) {
				const duplicate =
							await qryCheckCustomerDuplicate.run();

				if (duplicate?.length) {
					await storeValue(
						"customer_duplicate_name",
						customerName
					);

					await storeValue(
						"customer_duplicate_entity",
						"Customer"
					);

					await storeValue(
						"customer_duplicate_close_after",
						closeAfter
					);

					showModal(mdlCustomerDuplicateWarning.name);
					return;
				}
			}

			const result = await qryCusSaveMaster.run();

			const savedCustomerId = Number(
				result?.[0]?.customer_id ??
				result?.[0]?.id ??
				0
			);

			if (!savedCustomerId) {
				throw new Error(
					"Customer was saved, but its ID was not returned."
				);
			}

			await storeValue(
				"current_customer_id",
				savedCustomerId
			);

			await storeValue(
				"original_customer_name",
				customerName
			);

			await qryCusGetCustomers.run();

			closeModal(mdlCustomerDuplicateWarning.name);

			if (closeAfter) {
				closeModal(mdlCustomer.name);

				await this.clearState();

				showAlert("Customer saved.", "success");
			} else {
				await this.prepareNew();

				showAlert(
					"Customer saved. Ready for next Customer.",
					"success"
				);
			}
		} catch (error) {
			showAlert(
				error?.message ||
				"Customer could not be saved.",
				"error"
			);
		}
	},

	async confirmDuplicate() {
		closeModal(mdlCustomerDuplicateWarning.name);

		await this.save(
			appsmith.store.customer_duplicate_close_after !== false,
			true
		);
	},

	async prepareNew() {
		await storeValue("customer_form_mode", "add");

		await removeValue("current_customer_id");
		await removeValue("current_customer_record");
		await removeValue("original_customer_name");

		await storeValue("customer_contact_ids", []);
		await storeValue("customerAccordion", "");

		resetWidget("mdlCustomer", true);
		resetWidget("msCustomerContacts", true);
	},

	async clearState() {
		await removeValue("current_customer_id");
		await removeValue("current_customer_record");
		await removeValue("customer_form_mode");
		await removeValue("original_customer_name");

		await removeValue("customer_duplicate_name");
		await removeValue("customer_duplicate_entity");
		await removeValue("customer_duplicate_close_after");
		await removeValue("customer_duplicate_save_and_new");

		await storeValue("customer_contact_ids", []);
		await storeValue("customerAccordion", "");
	},

	async close() {
		closeModal(mdlCustomer.name);
		await this.clearState();
	},

	async openNew() {
		await this.prepareNew();
		showModal(mdlCustomer.name);
	},

	async openEdit() {
		const selectedCustomer = tblCustomers.selectedRow;
		const customerId = Number(selectedCustomer?.id || 0);

		if (!customerId) {
			showAlert(
				"Select a Customer to edit.",
				"warning"
			);
			return;
		}

		await storeValue(
			"current_customer_id",
			customerId
		);

		await storeValue(
			"customer_form_mode",
			"edit"
		);

		await storeValue(
			"current_customer_record",
			selectedCustomer
		);

		await storeValue(
			"original_customer_name",
			selectedCustomer.customer_name || ""
		);

		await storeValue("customerAccordion", "");

		await qryCusGetContactLinks.run();

		const contactIds = (
			qryCusGetContactLinks.data || []
		).map(row => String(row.contact_id));

		await storeValue(
			"customer_contact_ids",
			contactIds
		);

		resetWidget("mdlCustomer", true);
		resetWidget("msCustomerContacts", true);

		showModal(mdlCustomer.name);
	},

	async duplicate() {
		const sourceCustomer = tblCustomers.selectedRow;
		const sourceId = Number(sourceCustomer?.id || 0);

		if (!sourceId) {
			showAlert(
				"Select a Customer to duplicate.",
				"warning"
			);
			return;
		}

		try {
			const result =
						await qryCusDuplicateMaster.run();

			const newCustomerId = Number(
				result?.[0]?.customer_id ??
				result?.[0]?.new_customer_id ??
				result?.[0]?.id ??
				0
			);

			if (!newCustomerId) {
				throw new Error(
					"The duplicated Customer ID was not returned."
				);
			}

			await qryCusGetCustomers.run();

			const duplicatedCustomer = (
				qryCusGetCustomers.data || []
			).find(
				row => Number(row.id) === newCustomerId
			);

			if (!duplicatedCustomer) {
				throw new Error(
					"The duplicated Customer could not be loaded."
				);
			}

			await storeValue(
				"current_customer_id",
				newCustomerId
			);

			await storeValue(
				"customer_form_mode",
				"edit"
			);

			await storeValue(
				"current_customer_record",
				duplicatedCustomer
			);

			await storeValue(
				"original_customer_name",
				duplicatedCustomer.customer_name || ""
			);

			await storeValue("customerAccordion", "");

			await qryCusGetContactLinks.run();

			const contactIds = (
				qryCusGetContactLinks.data || []
			).map(row => String(row.contact_id));

			await storeValue(
				"customer_contact_ids",
				contactIds
			);

			resetWidget("mdlCustomer", true);
			resetWidget("msCustomerContacts", true);

			showModal(mdlCustomer.name);

			showAlert(
				`${duplicatedCustomer.customer_name} created.`,
				"success"
			);
		} catch (error) {
			showAlert(
				error?.message ||
				"Customer could not be duplicated.",
				"error"
			);
		}
	},

	async openDelete() {
		const customerId = Number(tblCustomers.selectedRow?.id || 0);

		if (!customerId) {
			showAlert("Select a Customer to delete.", "warning");
			return;
		}

		try {
			await qryCusGetDeleteImpact.run();

			showModal(mdlCusDeleteConfirm.name);
		} catch (error) {
			showAlert(
				error?.message ||
				"Customer impact could not be checked.",
				"error"
			);
		}
	},

	async deleteCustomer() {
		const customerId = Number(
			appsmith.store.current_customer_id || 0
		);

		if (!customerId) {
			showAlert(
				"No Customer is selected.",
				"warning"
			);

			closeModal(mdlCusDeleteConfirm.name);
			return;
		}

		const customerName =
					appsmith.store.current_customer_record
		?.customer_name ||
					tblCustomers.selectedRow?.customer_name ||
					"Customer";

		try {
			const result = await qryCusDeleteCustomer.run();

			const deletedRow = Array.isArray(result)
			? result[0]
			: Array.isArray(qryCusDeleteCustomer.data)
			? qryCusDeleteCustomer.data[0]
			: result;

			const deletedCustomerId = Number(
				deletedRow?.customer_id || 0
			);

			if (
				!deletedCustomerId ||
				deletedRow?.deleted !== true
			) {
				throw new Error(
					"The Customer was not deleted."
				);
			}

			closeModal(mdlCusDeleteConfirm.name);
			closeModal(mdlCustomer.name);

			await qryCusGetCustomers.run();
			await this.clearState();

			resetWidget("tblCustomers", true);

			showAlert(
				`${customerName} deleted.`,
				"success"
			);
		} catch (error) {
			showAlert(
				error?.message ||
				"Customer could not be deleted.",
				"error"
			);
		}
	},

	async setActive(customerId, active) {
		const id = Number(customerId || 0);

		if (!id) {
			showAlert(
				"Customer ID is missing.",
				"error"
			);

			await qryCusGetCustomers.run();
			return;
		}

		try {
			await qryCusToggleActive.run({
				customer_id: id,
				active: active === true
			});

			await qryCusGetCustomers.run();
		} catch (error) {
			showAlert(
				error?.message ||
				"Customer status could not be updated.",
				"error"
			);

			await qryCusGetCustomers.run();
		}
	},

	async toggleActive() {
		const row = tblCustomers.triggeredRow;

		const customerId = Number(row?.id || 0);

		if (!customerId) {
			showAlert("Customer ID is missing.", "error");
			await qryCusGetCustomers.run();
			return;
		}

		try {
			await qryCusToggleActive.run({
				customer_id: customerId,
				active: Boolean(row.active)
			});

			await qryCusGetCustomers.run();

		} catch (error) {
			showAlert(
				error?.message || "Customer status could not be updated.",
				"error"
			);

			await qryCusGetCustomers.run();
		}
	},

	async cancelDelete() {
		closeModal(mdlCusDeleteConfirm.name);

		await removeValue("current_customer_id");
		await removeValue("current_customer_record");
	},

	customerSnapshotFromPage() {
		return {
			name: (inpCustomerName.text || "").trim(),
			company: (inpCustomerCompany.text || "").trim(),
			address: (inpCustomerAddress.text || "").trim(),
			phone: (inpCustomerPhone.text || "").trim(),
			mobile: (inpCustomerMobile.text || "").trim(),
			email: (inpCustomerEmail.text || "").trim(),
			website: (inpCustomerWebsite.text || "").trim(),
			notes: (inpCustomerNotes.text || "").trim(),
			active: chkCustomerActive.isChecked !== false,

			contact_ids: (msCustomerContacts.selectedOptionValues || [])
			.map(Number)
			.filter(Boolean)
			.sort((a, b) => a - b)
		};
	},

	customerSnapshotFromSaved() {
		const saved =
					appsmith.store.current_customer_record || {};

		return {
			name: (saved.customer_name || "").trim(),
			company: (saved.company || "").trim(),
			address: (saved.address || "").trim(),
			phone: (saved.phone || "").trim(),
			mobile: (saved.mobile || "").trim(),
			email: (saved.email || "").trim(),
			website: (saved.website || "").trim(),
			notes: (saved.notes || "").trim(),
			active: saved.active !== false,

			contact_ids: (appsmith.store.customer_contact_ids || [])
			.map(Number)
			.filter(Boolean)
			.sort((a, b) => a - b)
		};
	},

	isDirty() {
		const page = this.customerSnapshotFromPage();
		const saved = this.customerSnapshotFromSaved();

		return JSON.stringify(page) !== JSON.stringify(saved);
	},

};