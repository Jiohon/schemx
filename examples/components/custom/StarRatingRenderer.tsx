import { defineComponent, h } from "vue"

// 星级评分渲染器（自定义样式）
export const StarRatingRenderer = defineComponent({
  name: "StarRatingRenderer",
  props: {
    modelValue: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 5,
    },
    disabled: Boolean,
    readonly: Boolean,
    allowHalf: Boolean,
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const handleClick = (index: number) => {
      if (props.disabled || props.readonly) return
      emit("update:modelValue", index)
    }

    return () =>
      h("div", { class: "star-rating" }, [
        Array.from({ length: props.max }, (_, i) => i + 1).map((index) =>
          h(
            "span",
            {
              class: ["star", { active: index <= props.modelValue }],
              onClick: () => handleClick(index),
            },
            index <= props.modelValue ? "★" : "☆"
          )
        ),
        h("span", { class: "rating-text" }, `${props.modelValue} / ${props.max}`),
      ])
  },
})
