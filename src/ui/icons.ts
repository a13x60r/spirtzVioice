/**
 * Icon system using Material Symbols Outlined.
 * Each icon is a <span> element with the Material Symbols class.
 */
const buildIcon = (name: string) =>
    `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;

export const ICONS = {
    library: buildIcon('list'),
    newDoc: buildIcon('add'),
    switchView: buildIcon('import_contacts'),
    settings: buildIcon('settings'),
    install: buildIcon('download'),
    close: buildIcon('close'),
    info: buildIcon('info')
};
