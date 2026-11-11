export default {
	async save(closeAfter = true, bypassDuplicate = false) {
		const contactName = (inpContactName.text || "").trim();

		if (!contactName) {
			showAlert("Contact name is required.", "warning");
			return;
		}

		try {
			if (!bypassDuplicate) {
				const duplicate = await qryCheckContactDuplicate.run();

				if (duplicate?.length) {
					await storeValue("contact_duplicate_name", contactName);
					await storeValue(
						"contact_duplicate_close_after",
						closeAfter
					);

					showModal(mdlContactDuplicateWarning.name);
					return;
				}
			}

			await qryCtcSaveMaster.run();
			await qryCtcGetContacts.run();

			closeModal(mdlContactDuplicateWarning.name);

			if (closeAfter) {
				closeModal(mdlContact.name);

				await removeValue("contact_form_mode");
				await removeValue("current_contact_id");
				await removeValue("current_contact_record");

				showAlert("Contact saved.", "success");
			} else {
				await storeValue("contact_form_mode", "add");
				await removeValue("current_contact_id");
				await removeValue("current_contact_record");

				this.resetForm();

				showAlert(
					"Contact saved. Ready for next contact.",
					"success"
				);
			}
		} catch (error) {
			showAlert(
				error?.message || "Contact could not be saved.",
				"error"
			);
		}
	},

	resetForm() {
		resetWidget("inpContactName", true);
		resetWidget("inpContactTitle", true);
		resetWidget("inpContactPhone", true);
		resetWidget("inpContactMobile", true);
		resetWidget("inpContactEmail", true);
		resetWidget("inpContactNotes", true);
		resetWidget("chkContactActive", true);
	},

	async openEdit() {
		const selectedId = Number(tblContacts.selectedRow?.id || 0);

		if (!selectedId) {
			showAlert("Select a Contact to edit.", "warning");
			return;
		}

		const sourceRow = (qryCtcGetContacts.data || []).find(
			row => Number(row.id) === selectedId
		);

		if (!sourceRow) {
			showAlert("The selected Contact could not be loaded.", "error");
			return;
		}

		await storeValue("contact_form_mode", "edit");
		await storeValue("current_contact_id", sourceRow.id);
		await storeValue("current_contact_record", sourceRow);

		resetWidget("mdlContact", true);
		showModal(mdlContact.name);
	},

	async duplicateContact() {
		const sourceRow = tblContacts.selectedRow;

		if (!sourceRow?.id) {
			showAlert("Select a Contact to duplicate.", "warning");
			return;
		}

		try {
			const result = await qryCtcDuplicateContact.run();
			const newContactId = Number(
				result?.[0]?.new_contact_id || 0
			);

			if (!newContactId) {
				throw new Error(
					"The duplicated Contact ID was not returned."
				);
			}

			await qryCtcGetContacts.run();

			const newContact = (qryCtcGetContacts.data || []).find(
				row => Number(row.id) === newContactId
			);

			if (!newContact) {
				throw new Error(
					"The duplicated Contact could not be loaded."
				);
			}

			await storeValue("contact_form_mode", "edit");
			await storeValue("current_contact_id", newContactId);
			await storeValue("current_contact_record", newContact);

			resetWidget("mdlContact", true);
			showModal(mdlContact.name);

			showAlert(
				`${newContact.contact_name} created.`,
				"success"
			);
		} catch (error) {
			showAlert(
				error?.message || "Contact could not be duplicated.",
				"error"
			);
		}
	},

	async confirmDuplicate() {
		closeModal(mdlContactDuplicateWarning.name);

		await this.save(
			appsmith.store.contact_duplicate_close_after !== false,
			true
		);
	},

	openDelete() {
		if (!tblContacts.selectedRow?.id) {
			showAlert("Select a Contact to delete.", "warning");
			return;
		}

		showModal(mdlContactDelConfirm.name);
	},

	async deleteContact() {
		const sourceRow = tblContacts.selectedRow;

		if (!sourceRow?.id) {
			showAlert("No Contact is selected.", "warning");
			closeModal(mdlContactDelConfirm.name);
			return;
		}

		const contactName = sourceRow.contact_name || "Contact";

		try {
			const result = await qryCtcDeleteMaster.run();
			const deletedContact = result?.[0];

			if (
				Number(deletedContact?.contact_id || 0) !==
				Number(sourceRow.id)
			) {
				throw new Error("The Contact was not deleted.");
			}

			closeModal(mdlContactDelConfirm.name);

			await qryCtcGetContacts.run();

			await removeValue("current_contact_id");
			await removeValue("current_contact_record");
			await removeValue("contact_form_mode");

			resetWidget("tblContacts", true);

			showAlert(
				`${contactName} deleted.`,
				"success"
			);
		} catch (error) {
			showAlert(
				error?.message || "Contact could not be deleted.",
				"error"
			);
		}
	},

	cancelDelete() {
		closeModal(mdlContactDelConfirm.name);
	},

	async setActive(contactId, active) {
		const id = Number(contactId || 0);

		if (!id) {
			showAlert(
				"Contact ID is missing.",
				"error"
			);

			await qryCtcGetContacts.run();
			return;
		}

		try {
			await qryCtcToggleActive.run({
				contact_id: id,
				active: active === true
			});

			await qryCtcGetContacts.run();
		} catch (error) {
			showAlert(
				error?.message ||
				"Contact status could not be updated.",
				"error"
			);

			await qryCtcGetContacts.run();
		}
	},

	contactSnapshotFromPage() {
		return {
			name: (inpContactName.text || "").trim(),
			title: (inpContactTitle.text || "").trim(),
			phone: (inpContactPhone.text || "").trim(),
			mobile: (inpContactMobile.text || "").trim(),
			email: (inpContactEmail.text || "").trim(),
			notes: (inpContactNotes.text || "").trim(),
			active: chkContactActive.isChecked !== false,

			customer_ids: (msContactCustomers.selectedOptionValues || [])
			.map(Number)
			.filter(Boolean)
			.sort((a, b) => a - b),

			venue_ids: (msContactVenues.selectedOptionValues || [])
			.map(Number)
			.filter(Boolean)
			.sort((a, b) => a - b)
		};
	},

	contactSnapshotFromSaved() {
		const saved = appsmith.store.current_contact_record || {};

		return {
			name: (saved.contact_name || "").trim(),
			title: (saved.title || "").trim(),
			phone: (saved.phone || "").trim(),
			mobile: (saved.mobile || "").trim(),
			email: (saved.email || "").trim(),
			notes: (saved.notes || "").trim(),
			active: saved.active !== false,

			customer_ids: (saved.customer_ids || [])
			.map(Number)
			.filter(Boolean)
			.sort((a, b) => a - b),

			venue_ids: (saved.venue_ids || [])
			.map(Number)
			.filter(Boolean)
			.sort((a, b) => a - b)
		};
	},

	isDirty() {
		const page = this.contactSnapshotFromPage();
		const saved = this.contactSnapshotFromSaved();

		return JSON.stringify(page) !== JSON.stringify(saved);
	},
};