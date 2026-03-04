import { defineComponent, h } from "vue"

// 颜色选择器渲染器
export const ColorPickerRenderer = defineComponent({
  name: "ColorPickerRenderer",
  props: {
    modelValue: String,
    colors: {
      type: Array as () => string[],
      default: () => ["#1989fa", "#07c160", "#ee0a24", "#ff976a", "#ffdd00", "#7232dd"],
    },
    disabled: Boolean,
    readonly: Boolean,
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const handleSelect = (color: string) => {
      if (props.disabled || props.readonly) return
      emit("update:modelValue", color)
    }

    return () =>
      h("div", { class: "color-picker" }, [
        props.colors.map((color: string) =>
          h("div", {
            class: ["color-item", { active: props.modelValue === color }],
            style: { backgroundColor: color },
            onClick: () => handleSelect(color),
          })
        ),
        h("div", { class: "current-color" }, [
          h("span", "当前颜色: "),
          h("span", {
            class: "color-preview",
            style: { backgroundColor: props.modelValue },
          }),
          h("span", props.modelValue),
        ]),
      ])
  },
})
