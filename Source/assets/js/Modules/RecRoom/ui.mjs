export const ui = {

	init: {
		inputs: async () => {
			const inputElements = $('.rr-text-input');
			$.each(inputElements, function () {
				const inputRoot = $(this);
				const inputElement = inputRoot.find('input');
				const inputClearer = inputRoot.find('.rr-input-btns .rr-input-clear');
				if (inputClearer.length > 0) {
					inputClearer.on('click', function () {
						if (inputClearer.hasClass('disabled')) return;
						inputElement.val('');
						inputElement.trigger('input');
						inputClearer.addClass('disabled');
					});
					inputElement.on('input', function () {
						if (inputElement.val().length > 0) {
							inputClearer.removeClass('disabled');
						} else {
							inputClearer.addClass('disabled');
						}
					});
					inputElement.trigger('input');
				}

				const inputButtons = inputRoot.find('.rr-input-btns > div');
				if (inputButtons.length > 0) {
					const inputButtonsRoot = inputButtons.parent();
					const inputButtonsWidth = inputButtonsRoot.outerWidth();
					inputElement.css('padding-right', 'calc(' + inputButtonsWidth + 'px + (var(--rr-border-width) * 4))');
				}
			});
		}
	}

};