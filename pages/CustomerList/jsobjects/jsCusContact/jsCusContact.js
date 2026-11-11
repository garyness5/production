export default {
	async save(saveAndNew = false, bypassDuplicate = false) {
		const contactName =
					(inpContactName.text || "").trim();

		if (!contactName) {
			showAlert(
				"Contact name is required.",
				"warning"
			);
			return;
		}

		try {
			if (!bypassDuplicate) {
				const duplicate =
							await qryCusCheckContactDuplicate.run();

				if (duplicate?.length) {
					await storeValue(
						"customer_duplicate_name",
						contactName
					);

					await storeValue(
						"customer_duplicate_entity",
						"Contact"
					);

					await storeValue(
						"customer_duplicate_save_and_new",
						saveAndNew
					);

					showModal("mdlCustomerDuplicateWarning");
					return;
				}
			}

			const existingIds = (
				msCustomerContacts.selectedOptionValues || []
			).map(String);

			const result = await qryCusSaveContactMaster.run();

			const savedRow = Array.isArray(result)
			? result[0]
			: Array.isArray(qryCusSaveContactMaster.data)
			? qryCusSaveContactMaster.data[0]
			: result;

			const contactId = Number(
				savedRow?.contact_id ??
				savedRow?.id ??
				0
			);

			if (!contactId) {
				throw new Error(
					"Contact was saved, but its ID was not returned."
				);
			}

			await qryCusGetContacts.run();

			const selectedIds = [
				...new Set([
					...existingIds,
					String(contactId)
				])
			];

			await storeValue(
				"customer_contact_ids",
				selectedIds
			);

			resetWidget("msCustomerContacts", true);

			await this.resetQuickFields();

			showAlert("Contact saved.", "success");

			if (!saveAndNew) {
				await storeValue(
					"customerAccordion",
					""
				);
			}
		} catch (error) {
			showAlert(
				error?.message ||
				"Contact could not be saved.",
				"error"
			);
		}
	},

	async confirmDuplicate() {
		closeModal("mdlCustomerDuplicateWarning");

		await this.save(
			appsmith.store
			.customer_duplicate_save_and_new === true,
			true
		);
	},

	async resetQuickFields() {
		await storeValue("contact_form_mode", "add");

		await removeValue("current_contact_id");
		await removeValue("current_contact_record");

		resetWidget("inpContactName", true);
		resetWidget("inpContactTitle", true);
		resetWidget("inpContactPhone", true);
		resetWidget("inpContactMobile", true);
		resetWidget("inpContactEmail", true);
		resetWidget("inpContactNotes", true);
	},

	async closeQuickAdd() {
		await this.resetQuickFields();
		await storeValue("customerAccordion", "");
	},

	async toggleAddAccordion() {
		if (
			appsmith.store.customerAccordion ===
			"addContact"
		) {
			await this.closeQuickAdd();
			return;
		}

		await this.resetQuickFields();

		await storeValue(
			"customerAccordion",
			"addContact"
		);
	},

	getContactOptions() {
		const selectedIds = new Set(
			(
				appsmith.store.customer_contact_ids || []
			).map(String)
		);

		return [...(qryCusGetContacts.data || [])]
			.sort((a, b) => {
			const aSelected = selectedIds.has(
				String(a.id)
			);

			const bSelected = selectedIds.has(
				String(b.id)
			);

			if (aSelected !== bSelected) {
				return aSelected ? -1 : 1;
			}

			return String(
				a.contact_name || ""
			).localeCompare(
				String(b.contact_name || ""),
				undefined,
				{ sensitivity: "base" }
			);
		})
			.map(contact => ({
			label:
			contact.display_name ||
			contact.contact_name,
			value: String(contact.id)
		}));
	}
};