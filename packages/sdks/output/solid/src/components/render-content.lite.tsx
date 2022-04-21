import { Show, onMount } from "solid-js";
import { Dynamic } from "solid-js/web";
import { createMutable } from "solid-js/store";

import { isBrowser } from "../functions/is-browser";
import BuilderContext from "../context/builder.context.lite";
import { track } from "../functions/track";
import { isReactNative } from "../functions/is-react-native";
import { isEditing } from "../functions/is-editing";
import { isPreviewing } from "../functions/is-previewing";
import { previewingModelName } from "../functions/previewing-model-name";
import { getContent } from "../functions/get-content";
import {
  convertSearchParamsToQueryObject,
  getBuilderSearchParams,
} from "../functions/get-builder-search-params";
import RenderBlocks from "./render-blocks.lite";
import { evaluate } from "../functions/evaluate";
import { getFetch } from "../functions/get-fetch";
import { onChange } from "../functions/on-change";
import { ifTarget } from "../functions/if-target";

export default function RenderContent(props) {
  const state = createMutable({
    get useContent() {
      const mergedContent: BuilderContent = {
        ...props.content,
        ...state.overrideContent,
        data: {
          ...props.content?.data,
          ...props.data,
          ...state.overrideContent?.data,
        },
      };
      return mergedContent;
    },
    overrideContent: null,
    update: 0,
    overrideState: {},
    get state() {
      return {
        ...props.content?.data?.state,
        ...props.data,
        ...state.overrideState,
      };
    },
    get context() {
      return {} as {
        [index: string]: any;
      };
    },
    getCssFromFont(font: any, data?: any) {
      // TODO: compute what font sizes are used and only load those.......
      const family =
        font.family +
        (font.kind && !font.kind.includes("#") ? ", " + font.kind : "");
      const name = family.split(",")[0];
      const url = font.fileUrl ?? font?.files?.regular;
      let str = "";

      if (url && family && name) {
        str += `
 @font-face {
   font-family: "${family}";
   src: local("${name}"), url('${url}') format('woff2');
   font-display: fallback;
   font-weight: 400;
 }
         `.trim();
      }

      if (font.files) {
        for (const weight in font.files) {
          const isNumber = String(Number(weight)) === weight;

          if (!isNumber) {
            continue;
          } // TODO: maybe limit number loaded

          const weightUrl = font.files[weight];

          if (weightUrl && weightUrl !== url) {
            str += `
 @font-face {
   font-family: "${family}";
   src: url('${weightUrl}') format('woff2');
   font-display: fallback;
   font-weight: ${weight};
 }
           `.trim();
          }
        }
      }

      return str;
    },
    getFontCss(data?: any) {
      // TODO: flag for this
      // if (!this.builder.allowCustomFonts) {
      //   return '';
      // }
      // TODO: separate internal data from external
      return (
        data?.customFonts
          ?.map((font: any) => this.getCssFromFont(font, data))
          ?.join(" ") || ""
      );
    },
    processMessage(event: MessageEvent) {
      const { data } = event;

      if (data) {
        switch (data.type) {
          case "builder.contentUpdate": {
            const messageContent = data.data;
            const key =
              messageContent.key ||
              messageContent.alias ||
              messageContent.entry ||
              messageContent.modelName;
            const contentData = messageContent.data;

            if (key === props.model) {
              state.overrideContent = contentData;
            }

            break;
          }

          case "builder.patchUpdates": {
            // TODO
            break;
          }
        }
      }
    },
    evaluateJsCode() {
      // run any dynamic JS code attached to content
      const jsCode = state.useContent?.data?.jsCode;

      if (jsCode) {
        evaluate({
          code: jsCode,
          context: state.context,
          state: state.state,
        });
      }
    },
    get httpReqsData() {
      return {};
    },
    evalExpression(expression: string) {
      return expression.replace(/{{([^}]+)}}/g, (_match, group) =>
        evaluate({
          code: group,
          context: state.context,
          state: state.state,
        })
      );
    },
    handleRequest({ url, key }: { key: string; url: string }) {
      const fetchAndSetState = async () => {
        const response = await getFetch()(url);
        const json = await response.json();
        const newOverrideState = { ...state.overrideState, [key]: json };
        state.overrideState = newOverrideState;
      };

      fetchAndSetState();
    },
    runHttpRequests() {
      const requests = state.useContent?.data?.httpRequests ?? {};
      Object.entries(requests).forEach(([key, url]) => {
        if (url && (!state.httpReqsData[key] || isEditing())) {
          const evaluatedUrl = state.evalExpression(url);
          state.handleRequest({
            url: evaluatedUrl,
            key,
          });
        }
      });
    },
    emitStateUpdate() {
      window.dispatchEvent(
        new CustomEvent<BuilderComponentStateChange>(
          "builder:component:stateChange",
          {
            detail: {
              state: state.state,
              ref: {
                name: props.model,
              },
            },
          }
        )
      );
    },
  });

  onMount(() => {
    if (isBrowser()) {
      if (isEditing()) {
        window.addEventListener("message", state.processMessage);
        window.addEventListener(
          "builder:component:stateChangeListenerActivated",
          state.emitStateUpdate
        );
      }

      if (state.useContent) {
        track("impression", {
          contentId: state.useContent.id,
        });
      } // override normal content in preview mode

      if (isPreviewing()) {
        if (props.model && previewingModelName() === props.model) {
          const currentUrl = new URL(location.href);
          const previewApiKey = currentUrl.searchParams.get("apiKey");

          if (previewApiKey) {
            getContent({
              model: props.model,
              apiKey: previewApiKey,
              options: getBuilderSearchParams(
                convertSearchParamsToQueryObject(currentUrl.searchParams)
              ),
            }).then((content) => {
              if (content) {
                state.overrideContent = content;
              }
            });
          }
        }
      }

      state.evaluateJsCode();
      state.runHttpRequests();
      state.emitStateUpdate();
    }
  });

  return (
    <Dynamic
      value={{
        get content() {
          return state.useContent;
        },
        get state() {
          return state.state;
        },
        get context() {
          return state.context;
        },
        get apiKey() {
          return props.apiKey;
        },
      }}
      component={BuilderContext.Provider}
    >
      <Show when={state.state.useContent}>
        <div
          onClick={(event) =>
            track("click", {
              contentId: state.state.useContent.id,
            })
          }
          data-builder-content-id={state.state.useContent?.id}
        >
          <Show
            when={
              (state.state.useContent?.data?.cssCode ||
                state.state.useContent?.data?.customFonts?.length) &&
              !isReactNative()
            }
          >
            <style>
              {state.state.useContent.data.cssCode}
              {state.state.getFontCss(state.state.useContent.data)}
            </style>
          </Show>
          <RenderBlocks
            blocks={state.state.useContent?.data?.blocks}
          ></RenderBlocks>
        </div>
      </Show>
    </Dynamic>
  );
}
