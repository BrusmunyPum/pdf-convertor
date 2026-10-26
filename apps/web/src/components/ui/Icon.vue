<script setup lang="ts">
// Material Design Icons as inline SVG paths (tree-shaken, no icon font download)
withDefaults(defineProps<{ path: string; size?: number | string }>(), { size: 20 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0">
    <path :d="path" fill="currentColor" />
  </svg>
</template>
