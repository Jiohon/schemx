import { defineComponent, h, ref } from "vue"

// 标签输入渲染器
export const TagInputRenderer = defineComponent({
  name: "TagInputRenderer",
  props: {
    modelValue: {
      type: Array as () => string[],
      default: () => [],
    },
    placeholder: {
      type: String,
      default: "输入后按回车添加",
    },
    maxTags: {
      type: Number,
      default: 10,
    },
    disabled: Boolean,
    readonly: Boolean,
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const inputValue = ref("")

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && inputValue.value.trim()) {
        e.preventDefault()
        if (props.modelValue.length >= props.maxTags) return
        if (props.modelValue.includes(inputValue.value.trim())) return

        emit("update:modelValue", [...props.modelValue, inputValue.value.trim()])
        inputValue.value = ""
      }
    }

    const handleRemove = (index: number) => {
      if (props.disabled || props.readonly) return
      const newTags = [...props.modelValue]
      newTags.splice(index, 1)
      emit("update:modelValue", newTags)
    }

    return () =>
      h("div", { class: "tag-input" }, [
        h("div", { class: "tags" }, [
          props.modelValue.map((tag: string, index: number) =>
            h("span", { class: "tag", key: tag }, [
              tag,
              !props.disabled &&
                !props.readonly &&
                h(
                  "span",
                  {
                    class: "tag-close",
                    onClick: () => handleRemove(index),
                  },
                  "×"
                ),
            ])
          ),
        ]),
        !props.disabled &&
          !props.readonly &&
          h("input", {
            class: "tag-input-field",
            value: inputValue.value,
            placeholder: props.placeholder,
            onInput: (e: Event) => {
              inputValue.value = (e.target as HTMLInputElement).value
            },
            onKeydown: handleKeydown,
          }),
      ])
  },
})
