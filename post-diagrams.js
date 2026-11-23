const dialog = document.querySelector('#post-diagram-dialog');

if (dialog && typeof dialog.showModal === 'function') {
  const preview = document.createElement('img');
  dialog.append(preview);

  for (const image of document.querySelectorAll('.post-diagram > img')) {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'post-diagram-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.setAttribute('aria-label', `放大查看配图：${image.alt}`);
    image.before(trigger);
    trigger.append(image);

    trigger.addEventListener('click', () => {
      preview.alt = image.alt;
      preview.src = image.currentSrc || image.src;
      trigger.focus({ preventScroll: true });
      dialog.showModal();
    });
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
