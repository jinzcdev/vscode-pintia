import { l10n, QuickPickItem, window } from "vscode";
import { ptaConfig } from "../ptaConfig";
import { langCompilerMapping } from "../shared";


export async function changeDefaultLanguage(): Promise<void> {

    const defaultLanguage: string = ptaConfig.getDefaultLanguage();
    const languages = langCompilerMapping.keys();

    const languageItems: QuickPickItem[] = [];
    for (const language of languages) {
        languageItems.push({
            label: language,
            description: defaultLanguage === language ? "Currently used" : undefined,
        });
    }
    // Put the default language at the top of the list
    languageItems.sort((a: QuickPickItem, b: QuickPickItem) => {
        if (a.description) {
            return Number.MIN_SAFE_INTEGER;
        } else if (b.description) {
            return Number.MAX_SAFE_INTEGER;
        }
        return a.label.localeCompare(b.label);
    });

    const selectedItem: QuickPickItem | undefined = await window.showQuickPick(languageItems, {
        placeHolder: l10n.t("Please the default language"),
        ignoreFocusOut: true,
    });

    if (!selectedItem) {
        return;
    }

    ptaConfig.update("defaultLanguage", selectedItem.label);
    window.showInformationMessage(l10n.t("Successfully set the default language to {0}", selectedItem.label));
}
