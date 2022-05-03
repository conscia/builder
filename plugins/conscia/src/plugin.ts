import { registerDataPlugin } from '@builder.io/data-plugin-tools';
import pkg from '../package.json';
import appState from '@builder.io/app-context';
import qs from 'qs';

const safeFetch = async (...args) => {
  const response = await fetch(...args);
  
  if (!response.ok) {
    const json = await response.json();
    const err = new Error(`HTTP Error ${response.status} : ${JSON.stringify(json)}`);
    err.response = response;
    throw err;
  }
  return response;
};

const pluginId = pkg.name;
const PROXY_URL = 'https://1a8e-113-211-210-113.ngrok.io/proxy';
const ENGINE_API = 'https://engine.conscia.io/api';

registerDataPlugin(
  {
    id: pluginId,
    name: 'Conscia DX Engine',
    icon: 'https://storage.conscia.co/images/img-logos/logo_conscia.png',
    settings: [
      {
        name: 'customerCode',
        type: 'string',
        required: true,
        helperText:
          'Your Conscia Customer Code',
      },
      {
        name: 'apiKey',
        type: 'string',
        required: true,
        helperText:
          'Your Conscia DX Engine API Key',
      },
    ],
    ctaText: `Build pages with Conscia DX Engine`,
  },
  // Observable map of the settings configured above
  async settings => {
    const customerCode = settings.get('customerCode')?.trim();
    const apiKey = settings.get('apiKey')?.trim();

    const contentTypes = [{ name: 'Template', id: 'template' }];
    return {
      async getResourceTypes() {
        return contentTypes.map(type => ({
          name: type.name,
          id: type.id,
          canPickEntries: true,
          entryInputs: () => {
            return [
              {
                friendlyName: `Context JSON`,
                name: 'context',
                type: 'text',
              },
            ];
          },
          toUrl: (options: any) => {
            // by entry
            if (options.entry) {
              const { context } = options;
              let baseContext = {};
              try {
                baseContext = JSON.parse(context);
              } catch (err) {
                console.warn('Invalid Base Context JSON', context);
              }

              const locationContext = qs.parse(window.location.search, { ignoreQueryPrefix: true });

              // return specific entry public URL
              console.log('Building public url with base context:', baseContext, 'location context:', locationContext);
              const payload = {
                context: { ...baseContext, ...locationContext },
                headers: {
                  'X-Customer-Code': customerCode,
                  Authorization: apiKey
                },
                templateCode: options.entry,
                debug: true,
              };
              const url = `${PROXY_URL}/experience/${type.id}/_query?${qs.stringify(payload)}`
              console.log('Built URL:', url);
              return url;
            }
            // querying not supported
            return '';
          },
        }));
      },
      async getEntriesByResourceType(id: string, options) {
        const response = await safeFetch(`${ENGINE_API}/experience/${id}s`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-Customer-Code': customerCode,
          }
        });
        let templates = await response.json();
        templates = templates.map(({ templateCode, name }) => ({ name, id: templateCode }));
        console.log('Templates Found:', templates);

        if (options?.searchText) {
          templates = templates.filter(({ name }) => name.toLowerCase().indexOf(options?.searchText?.toLowerCase()) !== -1);
        } else if (options?.resourceEntryId) {
          templates = templates.filter(({ id }) => id === options?.resourceEntryId);
        }
        return templates;
      },
    };
  }
);
