// Only a just-created private user-data-dir. Never global Chrome/OS/site settings.
import{mkdir,writeFile}from'node:fs/promises';import{join}from'node:path';
export async function initializeAuthlessProfile(profile){const dir=join(profile,'Default');await mkdir(dir,{mode:0o700});await writeFile(join(dir,'Preferences'),JSON.stringify({profile:{default_content_setting_values:{cookies:2}}}),{flag:'wx',mode:0o600});}
