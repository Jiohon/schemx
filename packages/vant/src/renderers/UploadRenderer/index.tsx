import { computed, defineComponent, PropType, ref, SetupContext, watch } from "vue"

import { Uploader } from "vant"

import classNames from "classnames"

import { getFileName } from "@/utils"
import "./index.scss"

export interface UploadFile {
  url?: string
  uid?: string
  status?: "uploading" | "done" | "failed"
  message?: string
  file?: File
  [key: string]: any
}

export interface UploadRendererProps {
  value?: UploadFile[]
  accept?: string
  onChange?: (files: UploadFile[]) => void
  className?: string
  showUpload?: boolean
  disableUpload?: boolean
  deletable?: boolean
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  uploader?: (file: File) => Promise<any>
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  propsHttp?: {
    res?: string
    url?: string
    name?: string
  }
  error?: string[]
}

/**
 * 上传渲染器组件
 * 完整继承 vant Uploader 组件的所有功能
 *
 */
const UploadRendererComponent = defineComponent({
  name: "UploadRendererComponent",
  props: {
    value: {
      type: Array as PropType<UploadFile[]>,
      default: () => [],
    },
    accept: {
      type: String,
      default: "*",
    },
    onChange: {
      type: Function as PropType<(files: UploadFile[]) => void>,
      default: () => {},
    },
    className: {
      type: String,
      default: "",
    },
    showUpload: {
      type: Boolean,
      default: true,
    },
    disableUpload: {
      type: Boolean,
      default: false,
    },
    deletable: {
      type: Boolean,
      default: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    readonlyPlaceholder: {
      type: String,
      default: "-",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    uploader: {
      type: Function as PropType<(file: File) => Promise<any>>,
      default: () => Promise.resolve({}),
    },
    formItemProps: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
    formInstance: {
      type: Object as PropType<Record<string, any> | null>,
      default: null,
    },
    propsHttp: {
      type: Object as PropType<{ res?: string; url?: string; name?: string }>,
      default: () => ({
        res: "data",
        url: "link",
        name: "originalName",
      }),
    },
    error: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
  },
  setup(props, { attrs }: SetupContext) {
    const uploadRef = ref<InstanceType<typeof Uploader> | null>(null)
    // 内部上传中的文件列表（status 为 uploading 的文件）
    const uploadingFiles = ref<UploadFile[]>([])

    /**
     * 将外部值标准化为文件对象
     */
    const normalizeFile = (item: any): UploadFile | null => {
      if (!item) return null
      const url = item?.url || item

      return {
        ...(typeof item === "string" ? {} : item),
        url,
        uid: item?.uid || getFileName(url),
        status: item?.status || "done",
      }
    }

    /**
     * 合并 props.value 和上传中的文件，去重
     */
    const innerFileList = computed(() => {
      const propsFiles = (Array.isArray(props.value) ? props.value : [props.value])
        .filter(Boolean)
        .map(normalizeFile)
        .filter(Boolean) as UploadFile[]

      // 合并外部值和上传中的文件
      const fileMap = new Map<string, UploadFile>()

      // 先添加外部值
      propsFiles.forEach((file) => {
        if (file.uid) {
          fileMap.set(file.uid, file)
        }
      })

      // 再添加上传中的文件（覆盖同 uid 的）
      uploadingFiles.value.forEach((file) => {
        if (file.uid) {
          fileMap.set(file.uid, file)
        }
      })

      return Array.from(fileMap.values())
    })

    // 监听外部 value 变化，清理已完成上传的文件
    watch(
      () => props.value,
      (newVal) => {
        // 如果外部值被清空，同时清空上传中的文件
        if (!newVal || (Array.isArray(newVal) && newVal.length === 0)) {
          uploadingFiles.value = []
        }
      },
      { deep: true }
    )

    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
    const deletable = computed(() => (readonly.value ? false : props.deletable))

    const showUpload = computed(() => (readonly.value ? false : props.showUpload))

    /**
     * 上传成功
     */
    const onSuccess = (res: any, file: UploadFile): void => {
      const index = uploadingFiles.value.findIndex((i) => i.uid === file.uid)

      if (index === -1) return

      // 更新上传中文件的状态
      const completedFile: UploadFile = {
        ...uploadingFiles.value[index],
        url: res[props.propsHttp.res!][props.propsHttp.url!],
        name: res[props.propsHttp.res!][props.propsHttp.name!],
        status: "done",
        message: "上传成功",
      }

      // 从上传中列表移除
      uploadingFiles.value = uploadingFiles.value.filter((i) => i.uid !== file.uid)

      // 获取当前已完成的文件列表，加上新完成的文件
      const currentDoneFiles = (Array.isArray(props.value) ? props.value : [])
        .filter(Boolean)
        .map(normalizeFile)
        .filter(Boolean) as UploadFile[]

      props.onChange?.([...currentDoneFiles, completedFile])
    }

    /**
     * 上传失败
     */
    const onFail = (_error: Error, file: UploadFile): void => {
      const index = uploadingFiles.value.findIndex((i) => i.uid === file.uid)

      if (index === -1) return

      uploadingFiles.value[index] = {
        ...uploadingFiles.value[index],
        status: "failed",
        message: "上传失败",
      }
    }

    const beforeRead = (
      file: File | File[]
    ): boolean | Promise<File | File[] | undefined> | undefined => {
      const attrsObj = attrs as Record<string, any>
      if (attrsObj.beforeRead) {
        return attrsObj.beforeRead(file)
      }

      return true
    }

    const afterRead = async (files: any | any[]): Promise<void> => {
      try {
        const attrsObj = attrs as Record<string, any>
        if (attrsObj.afterRead) {
          return attrsObj.afterRead(files)
        }

        const _fileList = Array.isArray(files) ? files : [files]

        const uploadList = _fileList.map((item) => {
          const newItem: UploadFile = {
            ...item,
            url: item.objectUrl,
            uid: getFileName(item.objectUrl),
            status: "uploading",
            message: "上传中...",
          }

          props
            .uploader?.(newItem.file!)
            .then((res) => {
              onSuccess(res, newItem)
            })
            .catch((error) => {
              onFail(error, newItem)
            })

          return newItem
        })

        uploadingFiles.value = [...uploadingFiles.value, ...uploadList]
      } catch (error: any) {
        console.error("Upload failed:", error.message || "上传失败")
      }
    }

    const onDelete = (file: UploadFile, detail: { index: number }): void => {
      const attrsObj = attrs as Record<string, any>
      if (attrsObj.onDelete) {
        return attrsObj.onDelete(file, detail)
      }

      // 如果是上传中的文件，从上传列表移除
      if (file.status === "uploading" || file.status === "failed") {
        uploadingFiles.value = uploadingFiles.value.filter((i) => i.uid !== file.uid)

        return
      }

      // 如果是已完成的文件，从外部值中移除
      const currentFiles = (Array.isArray(props.value) ? props.value : [])
        .filter(Boolean)
        .map(normalizeFile)
        .filter((i) => i && i.uid !== file.uid) as UploadFile[]

      props.onChange?.(currentFiles)
    }

    return () => (
      <>
        <Uploader
          result-type="file"
          multiple={true}
          {...attrs}
          ref={uploadRef}
          class={classNames(
            "schema-form-renderer",
            "schema-form-upload-renderer",
            props.className
          )}
          modelValue={innerFileList.value}
          showUpload={showUpload.value}
          deletable={deletable.value}
          disabled={disabled.value}
          readonly={readonly.value}
          beforeRead={beforeRead}
          afterRead={afterRead}
          onDelete={onDelete}
          accept={props.accept}
        />
      </>
    )
  },
})

export default UploadRendererComponent
