# D2 theme kit gallery

Editable, self-contained fences for Instant. Color identifies a named role or group. Labels remain authoritative; shuffled colors carry no status meaning.

## midnight / categorical / semantic

```d2
vars: { d2-config: { layout-engine: dagre; pad: 32 } }
direction: down
n0: "Data / observation"
n1: "Control / command"
n2: "Identity / reference"
n3: "Success / live"
n4: "Failure / closed"
n0 -> n4: "failure"
n5: "Warning / unresolved"
n1 -> n5: "warning"
n6: "Storage / durable"
n2 -> n6: "storage"
n7: "Inactive / deferred"
n3 -> n7: "inactive"
n8: "Data / observation"
n4 -> n8: "data"
n9: "Control / command"
n5 -> n9: "control"
n10: "Identity / reference"
n6 -> n10: "identity"
n11: "Success / live"
n7 -> n11: "success"
n12: "Failure / closed"
n8 -> n12: "failure"
n13: "Warning / unresolved"
n9 -> n13: "warning"
n14: "Storage / durable"
n10 -> n14: "storage"
n15: "Inactive / deferred"
n11 -> n15: "inactive"

# D2 theme kit: midnight / categorical
vars: { d2-config: { theme-id: 200; theme-overrides: { N1: "#edf3f8"; N2: "#edf3f8"; N3: "#edf3f8"; N4: "#c0cce0"; N5: "#1d252d"; N6: "#1d252d"; N7: "#101820"; B1: "#67d5e8"; B2: "#67d5e8"; B3: "#67d5e8"; B4: "#1d252d"; B5: "#1d252d"; B6: "#1d252d"; AA2: "#ffc66d"; AA4: "#1d252d"; AA5: "#1d252d"; AB4: "#1d252d"; AB5: "#1d252d" } } }
style.fill: "#101820"
classes: {
  kit_c0: { style.fill: "#1b313a"; style.stroke: "#67d5e8"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c0: { style.stroke: "#67d5e8"; style.font-color: "#67d5e8"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c1: { style.fill: "#2f2f2a"; style.stroke: "#ffc66d"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c1: { style.stroke: "#ffc66d"; style.font-color: "#ffc66d"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c2: { style.fill: "#212e3d"; style.stroke: "#91c4ff"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c2: { style.stroke: "#91c4ff"; style.font-color: "#91c4ff"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c3: { style.fill: "#23312d"; style.stroke: "#a5dc83"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c3: { style.stroke: "#a5dc83"; style.font-color: "#a5dc83"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c4: { style.fill: "#2f292d"; style.stroke: "#ff9784"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c4: { style.stroke: "#ff9784"; style.font-color: "#ff9784"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c5: { style.fill: "#2c302d"; style.stroke: "#e5d482"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c5: { style.stroke: "#e5d482"; style.font-color: "#e5d482"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c6: { style.fill: "#1d3133"; style.stroke: "#75d9b0"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c6: { style.stroke: "#75d9b0"; style.font-color: "#75d9b0"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c7: { style.fill: "#272f39"; style.stroke: "#c0cce0"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c7: { style.stroke: "#c0cce0"; style.font-color: "#c0cce0"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c8: { style.fill: "#2d2b2b"; style.stroke: "#f2ad78"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c8: { style.stroke: "#f2ad78"; style.font-color: "#f2ad78"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c9: { style.fill: "#1f2f37"; style.stroke: "#86cad4"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c9: { style.stroke: "#86cad4"; style.font-color: "#86cad4"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c10: { style.fill: "#26302a"; style.stroke: "#bcd16d"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c10: { style.stroke: "#bcd16d"; style.font-color: "#bcd16d"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c11: { style.fill: "#262c3c"; style.stroke: "#b7b5fb"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c11: { style.stroke: "#b7b5fb"; style.font-color: "#b7b5fb"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c12: { style.fill: "#2b2d31"; style.stroke: "#e2bda5"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c12: { style.stroke: "#e2bda5"; style.font-color: "#e2bda5"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c13: { style.fill: "#1e2c3b"; style.stroke: "#7eb5ef"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c13: { style.stroke: "#7eb5ef"; style.font-color: "#7eb5ef"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c14: { style.fill: "#293231"; style.stroke: "#d4dfa4"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c14: { style.stroke: "#d4dfa4"; style.font-color: "#d4dfa4"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c15: { style.fill: "#282f36"; style.stroke: "#c5c9cb"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c15: { style.stroke: "#c5c9cb"; style.font-color: "#c5c9cb"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_data: { style.fill: "#1b313a"; style.stroke: "#67d5e8"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_data: { style.stroke: "#67d5e8"; style.font-color: "#67d5e8"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_control: { style.fill: "#2f2f2a"; style.stroke: "#ffc66d"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_control: { style.stroke: "#ffc66d"; style.font-color: "#ffc66d"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_identity: { style.fill: "#212e3d"; style.stroke: "#91c4ff"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_identity: { style.stroke: "#91c4ff"; style.font-color: "#91c4ff"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_success: { style.fill: "#23312d"; style.stroke: "#a5dc83"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_success: { style.stroke: "#a5dc83"; style.font-color: "#a5dc83"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_failure: { style.fill: "#2f292d"; style.stroke: "#ff9784"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_failure: { style.stroke: "#ff9784"; style.font-color: "#ff9784"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_warning: { style.fill: "#2c302d"; style.stroke: "#e5d482"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_warning: { style.stroke: "#e5d482"; style.font-color: "#e5d482"; style.stroke-width: 3; style.stroke-dash: 3 }
  kit_storage: { style.fill: "#1d3133"; style.stroke: "#75d9b0"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_storage: { style.stroke: "#75d9b0"; style.font-color: "#75d9b0"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_inactive: { style.fill: "#272f39"; style.stroke: "#c0cce0"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_inactive: { style.stroke: "#c0cce0"; style.font-color: "#c0cce0"; style.stroke-width: 3; style.stroke-dash: 5 }
}

# Explicit group assignments
n0.style.stroke: "#67d5e8"
n0.style.stroke-width: 2
n0.style.fill: "#1b313a"
n0.style.font-color: "#edf3f8"
n1.style.stroke: "#ffc66d"
n1.style.stroke-width: 2
n1.style.fill: "#2f2f2a"
n1.style.font-color: "#edf3f8"
n2.style.stroke: "#91c4ff"
n2.style.stroke-width: 2
n2.style.fill: "#212e3d"
n2.style.font-color: "#edf3f8"
n3.style.stroke: "#a5dc83"
n3.style.stroke-width: 2
n3.style.fill: "#23312d"
n3.style.font-color: "#edf3f8"
n4.style.stroke: "#ff9784"
n4.style.stroke-width: 2
n4.style.fill: "#2f292d"
n4.style.font-color: "#edf3f8"
(n0 -> n4)[0].style.stroke: "#ff9784"
(n0 -> n4)[0].style.stroke-width: 3
(n0 -> n4)[0].style.font-color: "#ff9784"
(n0 -> n4)[0].style.stroke-dash: 0
n5.style.stroke: "#e5d482"
n5.style.stroke-width: 2
n5.style.fill: "#2c302d"
n5.style.font-color: "#edf3f8"
(n1 -> n5)[0].style.stroke: "#e5d482"
(n1 -> n5)[0].style.stroke-width: 3
(n1 -> n5)[0].style.font-color: "#e5d482"
(n1 -> n5)[0].style.stroke-dash: 3
n6.style.stroke: "#75d9b0"
n6.style.stroke-width: 2
n6.style.fill: "#1d3133"
n6.style.font-color: "#edf3f8"
(n2 -> n6)[0].style.stroke: "#75d9b0"
(n2 -> n6)[0].style.stroke-width: 3
(n2 -> n6)[0].style.font-color: "#75d9b0"
(n2 -> n6)[0].style.stroke-dash: 0
n7.style.stroke: "#c0cce0"
n7.style.stroke-width: 2
n7.style.fill: "#272f39"
n7.style.font-color: "#edf3f8"
(n3 -> n7)[0].style.stroke: "#c0cce0"
(n3 -> n7)[0].style.stroke-width: 3
(n3 -> n7)[0].style.font-color: "#c0cce0"
(n3 -> n7)[0].style.stroke-dash: 5
n8.style.stroke: "#67d5e8"
n8.style.stroke-width: 2
n8.style.fill: "#1b313a"
n8.style.font-color: "#edf3f8"
(n4 -> n8)[0].style.stroke: "#67d5e8"
(n4 -> n8)[0].style.stroke-width: 3
(n4 -> n8)[0].style.font-color: "#67d5e8"
(n4 -> n8)[0].style.stroke-dash: 0
n9.style.stroke: "#ffc66d"
n9.style.stroke-width: 2
n9.style.fill: "#2f2f2a"
n9.style.font-color: "#edf3f8"
(n5 -> n9)[0].style.stroke: "#ffc66d"
(n5 -> n9)[0].style.stroke-width: 3
(n5 -> n9)[0].style.font-color: "#ffc66d"
(n5 -> n9)[0].style.stroke-dash: 0
n10.style.stroke: "#91c4ff"
n10.style.stroke-width: 2
n10.style.fill: "#212e3d"
n10.style.font-color: "#edf3f8"
(n6 -> n10)[0].style.stroke: "#91c4ff"
(n6 -> n10)[0].style.stroke-width: 3
(n6 -> n10)[0].style.font-color: "#91c4ff"
(n6 -> n10)[0].style.stroke-dash: 0
n11.style.stroke: "#a5dc83"
n11.style.stroke-width: 2
n11.style.fill: "#23312d"
n11.style.font-color: "#edf3f8"
(n7 -> n11)[0].style.stroke: "#a5dc83"
(n7 -> n11)[0].style.stroke-width: 3
(n7 -> n11)[0].style.font-color: "#a5dc83"
(n7 -> n11)[0].style.stroke-dash: 0
n12.style.stroke: "#ff9784"
n12.style.stroke-width: 2
n12.style.fill: "#2f292d"
n12.style.font-color: "#edf3f8"
(n8 -> n12)[0].style.stroke: "#ff9784"
(n8 -> n12)[0].style.stroke-width: 3
(n8 -> n12)[0].style.font-color: "#ff9784"
(n8 -> n12)[0].style.stroke-dash: 0
n13.style.stroke: "#e5d482"
n13.style.stroke-width: 2
n13.style.fill: "#2c302d"
n13.style.font-color: "#edf3f8"
(n9 -> n13)[0].style.stroke: "#e5d482"
(n9 -> n13)[0].style.stroke-width: 3
(n9 -> n13)[0].style.font-color: "#e5d482"
(n9 -> n13)[0].style.stroke-dash: 3
n14.style.stroke: "#75d9b0"
n14.style.stroke-width: 2
n14.style.fill: "#1d3133"
n14.style.font-color: "#edf3f8"
(n10 -> n14)[0].style.stroke: "#75d9b0"
(n10 -> n14)[0].style.stroke-width: 3
(n10 -> n14)[0].style.font-color: "#75d9b0"
(n10 -> n14)[0].style.stroke-dash: 0
n15.style.stroke: "#c0cce0"
n15.style.stroke-width: 2
n15.style.fill: "#272f39"
n15.style.font-color: "#edf3f8"
(n11 -> n15)[0].style.stroke: "#c0cce0"
(n11 -> n15)[0].style.stroke-width: 3
(n11 -> n15)[0].style.font-color: "#c0cce0"
(n11 -> n15)[0].style.stroke-dash: 5
```

## charcoal / categorical / round-robin

```d2
vars: { d2-config: { layout-engine: dagre; pad: 32 } }
direction: down
n0: "Group 01"
n1: "Group 02"
n2: "Group 03"
n3: "Group 04"
n4: "Group 05"
n0 -> n4: "Group 05"
n5: "Group 06"
n1 -> n5: "Group 06"
n6: "Group 07"
n2 -> n6: "Group 07"
n7: "Group 08"
n3 -> n7: "Group 08"
n8: "Group 09"
n4 -> n8: "Group 09"
n9: "Group 10"
n5 -> n9: "Group 10"
n10: "Group 11"
n6 -> n10: "Group 11"
n11: "Group 12"
n7 -> n11: "Group 12"
n12: "Group 13"
n8 -> n12: "Group 13"
n13: "Group 14"
n9 -> n13: "Group 14"
n14: "Group 15"
n10 -> n14: "Group 15"
n15: "Group 16"
n11 -> n15: "Group 16"
n16: "Group 17"
n12 -> n16: "Group 17"
n17: "Group 18"
n13 -> n17: "Group 18"
n18: "Group 19"
n14 -> n18: "Group 19"
n19: "Group 20"
n15 -> n19: "Group 20"

# D2 theme kit: charcoal / categorical
vars: { d2-config: { theme-id: 200; theme-overrides: { N1: "#f5f2e9"; N2: "#f5f2e9"; N3: "#f5f2e9"; N4: "#c0cce0"; N5: "#313030"; N6: "#313030"; N7: "#242424"; B1: "#67d5e8"; B2: "#67d5e8"; B3: "#67d5e8"; B4: "#313030"; B5: "#313030"; B6: "#313030"; AA2: "#ffc66d"; AA4: "#313030"; AA5: "#313030"; AB4: "#313030"; AB5: "#313030" } } }
style.fill: "#242424"
classes: {
  kit_c0: { style.fill: "#2d3b3d"; style.stroke: "#67d5e8"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c0: { style.stroke: "#67d5e8"; style.font-color: "#67d5e8"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c1: { style.fill: "#40392d"; style.stroke: "#ffc66d"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c1: { style.stroke: "#ffc66d"; style.font-color: "#ffc66d"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c2: { style.fill: "#323940"; style.stroke: "#91c4ff"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c2: { style.stroke: "#91c4ff"; style.font-color: "#91c4ff"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c3: { style.fill: "#353c30"; style.stroke: "#a5dc83"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c3: { style.stroke: "#a5dc83"; style.font-color: "#a5dc83"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c4: { style.fill: "#403330"; style.stroke: "#ff9784"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c4: { style.stroke: "#ff9784"; style.font-color: "#ff9784"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c5: { style.fill: "#3d3b30"; style.stroke: "#e5d482"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c5: { style.stroke: "#e5d482"; style.font-color: "#e5d482"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c6: { style.fill: "#2f3c36"; style.stroke: "#75d9b0"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c6: { style.stroke: "#75d9b0"; style.font-color: "#75d9b0"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c7: { style.fill: "#383a3c"; style.stroke: "#c0cce0"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c7: { style.stroke: "#c0cce0"; style.font-color: "#c0cce0"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c8: { style.fill: "#3f362f"; style.stroke: "#f2ad78"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c8: { style.stroke: "#f2ad78"; style.font-color: "#f2ad78"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c9: { style.fill: "#313a3b"; style.stroke: "#86cad4"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c9: { style.stroke: "#86cad4"; style.font-color: "#86cad4"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c10: { style.fill: "#383a2d"; style.stroke: "#bcd16d"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c10: { style.stroke: "#bcd16d"; style.font-color: "#bcd16d"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c11: { style.fill: "#373740"; style.stroke: "#b7b5fb"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c11: { style.stroke: "#b7b5fb"; style.font-color: "#b7b5fb"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c12: { style.fill: "#3d3835"; style.stroke: "#e2bda5"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c12: { style.stroke: "#e2bda5"; style.font-color: "#e2bda5"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c13: { style.fill: "#30373e"; style.stroke: "#7eb5ef"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c13: { style.stroke: "#7eb5ef"; style.font-color: "#7eb5ef"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c14: { style.fill: "#3b3c35"; style.stroke: "#d4dfa4"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c14: { style.stroke: "#d4dfa4"; style.font-color: "#d4dfa4"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c15: { style.fill: "#39393a"; style.stroke: "#c5c9cb"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_c15: { style.stroke: "#c5c9cb"; style.font-color: "#c5c9cb"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_data: { style.fill: "#2d3b3d"; style.stroke: "#67d5e8"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_data: { style.stroke: "#67d5e8"; style.font-color: "#67d5e8"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_control: { style.fill: "#40392d"; style.stroke: "#ffc66d"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_control: { style.stroke: "#ffc66d"; style.font-color: "#ffc66d"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_identity: { style.fill: "#323940"; style.stroke: "#91c4ff"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_identity: { style.stroke: "#91c4ff"; style.font-color: "#91c4ff"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_success: { style.fill: "#353c30"; style.stroke: "#a5dc83"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_success: { style.stroke: "#a5dc83"; style.font-color: "#a5dc83"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_failure: { style.fill: "#403330"; style.stroke: "#ff9784"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_failure: { style.stroke: "#ff9784"; style.font-color: "#ff9784"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_warning: { style.fill: "#3d3b30"; style.stroke: "#e5d482"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_warning: { style.stroke: "#e5d482"; style.font-color: "#e5d482"; style.stroke-width: 3; style.stroke-dash: 3 }
  kit_storage: { style.fill: "#2f3c36"; style.stroke: "#75d9b0"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_storage: { style.stroke: "#75d9b0"; style.font-color: "#75d9b0"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_inactive: { style.fill: "#383a3c"; style.stroke: "#c0cce0"; style.font-color: "#f5f2e9"; style.stroke-width: 2 }
  kit_edge_inactive: { style.stroke: "#c0cce0"; style.font-color: "#c0cce0"; style.stroke-width: 3; style.stroke-dash: 5 }
}

# Explicit group assignments
n0.style.stroke: "#67d5e8"
n0.style.stroke-width: 2
n0.style.fill: "#2d3b3d"
n0.style.font-color: "#f5f2e9"
n1.style.stroke: "#ffc66d"
n1.style.stroke-width: 2
n1.style.fill: "#40392d"
n1.style.font-color: "#f5f2e9"
n2.style.stroke: "#91c4ff"
n2.style.stroke-width: 2
n2.style.fill: "#323940"
n2.style.font-color: "#f5f2e9"
n3.style.stroke: "#a5dc83"
n3.style.stroke-width: 2
n3.style.fill: "#353c30"
n3.style.font-color: "#f5f2e9"
n4.style.stroke: "#ff9784"
n4.style.stroke-width: 2
n4.style.fill: "#403330"
n4.style.font-color: "#f5f2e9"
(n0 -> n4)[0].style.stroke: "#ff9784"
(n0 -> n4)[0].style.stroke-width: 3
(n0 -> n4)[0].style.font-color: "#ff9784"
(n0 -> n4)[0].style.stroke-dash: 0
n5.style.stroke: "#e5d482"
n5.style.stroke-width: 2
n5.style.fill: "#3d3b30"
n5.style.font-color: "#f5f2e9"
(n1 -> n5)[0].style.stroke: "#e5d482"
(n1 -> n5)[0].style.stroke-width: 3
(n1 -> n5)[0].style.font-color: "#e5d482"
(n1 -> n5)[0].style.stroke-dash: 0
n6.style.stroke: "#75d9b0"
n6.style.stroke-width: 2
n6.style.fill: "#2f3c36"
n6.style.font-color: "#f5f2e9"
(n2 -> n6)[0].style.stroke: "#75d9b0"
(n2 -> n6)[0].style.stroke-width: 3
(n2 -> n6)[0].style.font-color: "#75d9b0"
(n2 -> n6)[0].style.stroke-dash: 0
n7.style.stroke: "#c0cce0"
n7.style.stroke-width: 2
n7.style.fill: "#383a3c"
n7.style.font-color: "#f5f2e9"
(n3 -> n7)[0].style.stroke: "#c0cce0"
(n3 -> n7)[0].style.stroke-width: 3
(n3 -> n7)[0].style.font-color: "#c0cce0"
(n3 -> n7)[0].style.stroke-dash: 0
n8.style.stroke: "#f2ad78"
n8.style.stroke-width: 2
n8.style.fill: "#3f362f"
n8.style.font-color: "#f5f2e9"
(n4 -> n8)[0].style.stroke: "#f2ad78"
(n4 -> n8)[0].style.stroke-width: 3
(n4 -> n8)[0].style.font-color: "#f2ad78"
(n4 -> n8)[0].style.stroke-dash: 0
n9.style.stroke: "#86cad4"
n9.style.stroke-width: 2
n9.style.fill: "#313a3b"
n9.style.font-color: "#f5f2e9"
(n5 -> n9)[0].style.stroke: "#86cad4"
(n5 -> n9)[0].style.stroke-width: 3
(n5 -> n9)[0].style.font-color: "#86cad4"
(n5 -> n9)[0].style.stroke-dash: 0
n10.style.stroke: "#bcd16d"
n10.style.stroke-width: 2
n10.style.fill: "#383a2d"
n10.style.font-color: "#f5f2e9"
(n6 -> n10)[0].style.stroke: "#bcd16d"
(n6 -> n10)[0].style.stroke-width: 3
(n6 -> n10)[0].style.font-color: "#bcd16d"
(n6 -> n10)[0].style.stroke-dash: 0
n11.style.stroke: "#b7b5fb"
n11.style.stroke-width: 2
n11.style.fill: "#373740"
n11.style.font-color: "#f5f2e9"
(n7 -> n11)[0].style.stroke: "#b7b5fb"
(n7 -> n11)[0].style.stroke-width: 3
(n7 -> n11)[0].style.font-color: "#b7b5fb"
(n7 -> n11)[0].style.stroke-dash: 0
n12.style.stroke: "#e2bda5"
n12.style.stroke-width: 2
n12.style.fill: "#3d3835"
n12.style.font-color: "#f5f2e9"
(n8 -> n12)[0].style.stroke: "#e2bda5"
(n8 -> n12)[0].style.stroke-width: 3
(n8 -> n12)[0].style.font-color: "#e2bda5"
(n8 -> n12)[0].style.stroke-dash: 0
n13.style.stroke: "#7eb5ef"
n13.style.stroke-width: 2
n13.style.fill: "#30373e"
n13.style.font-color: "#f5f2e9"
(n9 -> n13)[0].style.stroke: "#7eb5ef"
(n9 -> n13)[0].style.stroke-width: 3
(n9 -> n13)[0].style.font-color: "#7eb5ef"
(n9 -> n13)[0].style.stroke-dash: 0
n14.style.stroke: "#d4dfa4"
n14.style.stroke-width: 2
n14.style.fill: "#3b3c35"
n14.style.font-color: "#f5f2e9"
(n10 -> n14)[0].style.stroke: "#d4dfa4"
(n10 -> n14)[0].style.stroke-width: 3
(n10 -> n14)[0].style.font-color: "#d4dfa4"
(n10 -> n14)[0].style.stroke-dash: 0
n15.style.stroke: "#c5c9cb"
n15.style.stroke-width: 2
n15.style.fill: "#39393a"
n15.style.font-color: "#f5f2e9"
(n11 -> n15)[0].style.stroke: "#c5c9cb"
(n11 -> n15)[0].style.stroke-width: 3
(n11 -> n15)[0].style.font-color: "#c5c9cb"
(n11 -> n15)[0].style.stroke-dash: 0
n16.style.stroke: "#67d5e8"
n16.style.stroke-width: 2
n16.style.fill: "#2d3b3d"
n16.style.font-color: "#f5f2e9"
(n12 -> n16)[0].style.stroke: "#67d5e8"
(n12 -> n16)[0].style.stroke-width: 3
(n12 -> n16)[0].style.font-color: "#67d5e8"
(n12 -> n16)[0].style.stroke-dash: 3
n17.style.stroke: "#ffc66d"
n17.style.stroke-width: 2
n17.style.fill: "#40392d"
n17.style.font-color: "#f5f2e9"
(n13 -> n17)[0].style.stroke: "#ffc66d"
(n13 -> n17)[0].style.stroke-width: 3
(n13 -> n17)[0].style.font-color: "#ffc66d"
(n13 -> n17)[0].style.stroke-dash: 3
n18.style.stroke: "#91c4ff"
n18.style.stroke-width: 2
n18.style.fill: "#323940"
n18.style.font-color: "#f5f2e9"
(n14 -> n18)[0].style.stroke: "#91c4ff"
(n14 -> n18)[0].style.stroke-width: 3
(n14 -> n18)[0].style.font-color: "#91c4ff"
(n14 -> n18)[0].style.stroke-dash: 3
n19.style.stroke: "#a5dc83"
n19.style.stroke-width: 2
n19.style.fill: "#353c30"
n19.style.font-color: "#f5f2e9"
(n15 -> n19)[0].style.stroke: "#a5dc83"
(n15 -> n19)[0].style.stroke-width: 3
(n15 -> n19)[0].style.font-color: "#a5dc83"
(n15 -> n19)[0].style.stroke-dash: 3
```

## paper / categorical / round-robin

```d2
vars: { d2-config: { layout-engine: dagre; pad: 32 } }
direction: down
n0: "Group 01"
n1: "Group 02"
n2: "Group 03"
n3: "Group 04"
n4: "Group 05"
n0 -> n4: "Group 05"
n5: "Group 06"
n1 -> n5: "Group 06"
n6: "Group 07"
n2 -> n6: "Group 07"
n7: "Group 08"
n3 -> n7: "Group 08"
n8: "Group 09"
n4 -> n8: "Group 09"
n9: "Group 10"
n5 -> n9: "Group 10"
n10: "Group 11"
n6 -> n10: "Group 11"
n11: "Group 12"
n7 -> n11: "Group 12"
n12: "Group 13"
n8 -> n12: "Group 13"
n13: "Group 14"
n9 -> n13: "Group 14"
n14: "Group 15"
n10 -> n14: "Group 15"
n15: "Group 16"
n11 -> n15: "Group 16"
n16: "Group 17"
n12 -> n16: "Group 17"
n17: "Group 18"
n13 -> n17: "Group 18"
n18: "Group 19"
n14 -> n18: "Group 19"
n19: "Group 20"
n15 -> n19: "Group 20"

# D2 theme kit: paper / categorical
vars: { d2-config: { theme-id: 8; theme-overrides: { N1: "#18232d"; N2: "#18232d"; N3: "#18232d"; N4: "#495e7b"; N5: "#ecebe6"; N6: "#ecebe6"; N7: "#faf8f2"; B1: "#006b7c"; B2: "#006b7c"; B3: "#006b7c"; B4: "#ecebe6"; B5: "#ecebe6"; B6: "#ecebe6"; AA2: "#8b5100"; AA4: "#ecebe6"; AA5: "#ecebe6"; AB4: "#ecebe6"; AB5: "#ecebe6" } } }
style.fill: "#faf8f2"
classes: {
  kit_c0: { style.fill: "#dae6e3"; style.stroke: "#006b7c"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c0: { style.stroke: "#006b7c"; style.font-color: "#006b7c"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c1: { style.fill: "#ece2d3"; style.stroke: "#8b5100"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c1: { style.stroke: "#8b5100"; style.font-color: "#8b5100"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c2: { style.fill: "#dee4e8"; style.stroke: "#215ea8"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c2: { style.stroke: "#215ea8"; style.font-color: "#215ea8"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c3: { style.fill: "#e1e6d7"; style.stroke: "#376b21"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c3: { style.stroke: "#376b21"; style.font-color: "#376b21"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c4: { style.fill: "#eedfd7"; style.stroke: "#a03424"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c4: { style.stroke: "#a03424"; style.font-color: "#a03424"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c5: { style.fill: "#e8e4d3"; style.stroke: "#706000"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c5: { style.stroke: "#706000"; style.font-color: "#706000"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c6: { style.fill: "#dae6dc"; style.stroke: "#006c4c"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c6: { style.stroke: "#006c4c"; style.font-color: "#006c4c"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c7: { style.fill: "#e3e4e3"; style.stroke: "#495e7b"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c7: { style.stroke: "#495e7b"; style.font-color: "#495e7b"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c8: { style.fill: "#ede2d6"; style.stroke: "#995017"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c8: { style.stroke: "#995017"; style.font-color: "#995017"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c9: { style.fill: "#dee5e1"; style.stroke: "#266571"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c9: { style.stroke: "#266571"; style.font-color: "#266571"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c10: { style.fill: "#e4e6d3"; style.stroke: "#526b00"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c10: { style.stroke: "#526b00"; style.font-color: "#526b00"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c11: { style.fill: "#e5e2e7"; style.stroke: "#5651a0"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c11: { style.stroke: "#5651a0"; style.font-color: "#5651a0"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c12: { style.fill: "#eae3db"; style.stroke: "#805440"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c12: { style.stroke: "#805440"; style.font-color: "#805440"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c13: { style.fill: "#dfe5e6"; style.stroke: "#2c6294"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c13: { style.stroke: "#2c6294"; style.font-color: "#2c6294"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c14: { style.fill: "#e5e5d8"; style.stroke: "#56632c"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c14: { style.stroke: "#56632c"; style.font-color: "#56632c"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c15: { style.fill: "#e4e4df"; style.stroke: "#535b60"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_c15: { style.stroke: "#535b60"; style.font-color: "#535b60"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_data: { style.fill: "#dae6e3"; style.stroke: "#006b7c"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_data: { style.stroke: "#006b7c"; style.font-color: "#006b7c"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_control: { style.fill: "#ece2d3"; style.stroke: "#8b5100"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_control: { style.stroke: "#8b5100"; style.font-color: "#8b5100"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_identity: { style.fill: "#dee4e8"; style.stroke: "#215ea8"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_identity: { style.stroke: "#215ea8"; style.font-color: "#215ea8"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_success: { style.fill: "#e1e6d7"; style.stroke: "#376b21"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_success: { style.stroke: "#376b21"; style.font-color: "#376b21"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_failure: { style.fill: "#eedfd7"; style.stroke: "#a03424"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_failure: { style.stroke: "#a03424"; style.font-color: "#a03424"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_warning: { style.fill: "#e8e4d3"; style.stroke: "#706000"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_warning: { style.stroke: "#706000"; style.font-color: "#706000"; style.stroke-width: 3; style.stroke-dash: 3 }
  kit_storage: { style.fill: "#dae6dc"; style.stroke: "#006c4c"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_storage: { style.stroke: "#006c4c"; style.font-color: "#006c4c"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_inactive: { style.fill: "#e3e4e3"; style.stroke: "#495e7b"; style.font-color: "#18232d"; style.stroke-width: 2 }
  kit_edge_inactive: { style.stroke: "#495e7b"; style.font-color: "#495e7b"; style.stroke-width: 3; style.stroke-dash: 5 }
}

# Explicit group assignments
n0.style.stroke: "#006b7c"
n0.style.stroke-width: 2
n0.style.fill: "#dae6e3"
n0.style.font-color: "#18232d"
n1.style.stroke: "#8b5100"
n1.style.stroke-width: 2
n1.style.fill: "#ece2d3"
n1.style.font-color: "#18232d"
n2.style.stroke: "#215ea8"
n2.style.stroke-width: 2
n2.style.fill: "#dee4e8"
n2.style.font-color: "#18232d"
n3.style.stroke: "#376b21"
n3.style.stroke-width: 2
n3.style.fill: "#e1e6d7"
n3.style.font-color: "#18232d"
n4.style.stroke: "#a03424"
n4.style.stroke-width: 2
n4.style.fill: "#eedfd7"
n4.style.font-color: "#18232d"
(n0 -> n4)[0].style.stroke: "#a03424"
(n0 -> n4)[0].style.stroke-width: 3
(n0 -> n4)[0].style.font-color: "#a03424"
(n0 -> n4)[0].style.stroke-dash: 0
n5.style.stroke: "#706000"
n5.style.stroke-width: 2
n5.style.fill: "#e8e4d3"
n5.style.font-color: "#18232d"
(n1 -> n5)[0].style.stroke: "#706000"
(n1 -> n5)[0].style.stroke-width: 3
(n1 -> n5)[0].style.font-color: "#706000"
(n1 -> n5)[0].style.stroke-dash: 0
n6.style.stroke: "#006c4c"
n6.style.stroke-width: 2
n6.style.fill: "#dae6dc"
n6.style.font-color: "#18232d"
(n2 -> n6)[0].style.stroke: "#006c4c"
(n2 -> n6)[0].style.stroke-width: 3
(n2 -> n6)[0].style.font-color: "#006c4c"
(n2 -> n6)[0].style.stroke-dash: 0
n7.style.stroke: "#495e7b"
n7.style.stroke-width: 2
n7.style.fill: "#e3e4e3"
n7.style.font-color: "#18232d"
(n3 -> n7)[0].style.stroke: "#495e7b"
(n3 -> n7)[0].style.stroke-width: 3
(n3 -> n7)[0].style.font-color: "#495e7b"
(n3 -> n7)[0].style.stroke-dash: 0
n8.style.stroke: "#995017"
n8.style.stroke-width: 2
n8.style.fill: "#ede2d6"
n8.style.font-color: "#18232d"
(n4 -> n8)[0].style.stroke: "#995017"
(n4 -> n8)[0].style.stroke-width: 3
(n4 -> n8)[0].style.font-color: "#995017"
(n4 -> n8)[0].style.stroke-dash: 0
n9.style.stroke: "#266571"
n9.style.stroke-width: 2
n9.style.fill: "#dee5e1"
n9.style.font-color: "#18232d"
(n5 -> n9)[0].style.stroke: "#266571"
(n5 -> n9)[0].style.stroke-width: 3
(n5 -> n9)[0].style.font-color: "#266571"
(n5 -> n9)[0].style.stroke-dash: 0
n10.style.stroke: "#526b00"
n10.style.stroke-width: 2
n10.style.fill: "#e4e6d3"
n10.style.font-color: "#18232d"
(n6 -> n10)[0].style.stroke: "#526b00"
(n6 -> n10)[0].style.stroke-width: 3
(n6 -> n10)[0].style.font-color: "#526b00"
(n6 -> n10)[0].style.stroke-dash: 0
n11.style.stroke: "#5651a0"
n11.style.stroke-width: 2
n11.style.fill: "#e5e2e7"
n11.style.font-color: "#18232d"
(n7 -> n11)[0].style.stroke: "#5651a0"
(n7 -> n11)[0].style.stroke-width: 3
(n7 -> n11)[0].style.font-color: "#5651a0"
(n7 -> n11)[0].style.stroke-dash: 0
n12.style.stroke: "#805440"
n12.style.stroke-width: 2
n12.style.fill: "#eae3db"
n12.style.font-color: "#18232d"
(n8 -> n12)[0].style.stroke: "#805440"
(n8 -> n12)[0].style.stroke-width: 3
(n8 -> n12)[0].style.font-color: "#805440"
(n8 -> n12)[0].style.stroke-dash: 0
n13.style.stroke: "#2c6294"
n13.style.stroke-width: 2
n13.style.fill: "#dfe5e6"
n13.style.font-color: "#18232d"
(n9 -> n13)[0].style.stroke: "#2c6294"
(n9 -> n13)[0].style.stroke-width: 3
(n9 -> n13)[0].style.font-color: "#2c6294"
(n9 -> n13)[0].style.stroke-dash: 0
n14.style.stroke: "#56632c"
n14.style.stroke-width: 2
n14.style.fill: "#e5e5d8"
n14.style.font-color: "#18232d"
(n10 -> n14)[0].style.stroke: "#56632c"
(n10 -> n14)[0].style.stroke-width: 3
(n10 -> n14)[0].style.font-color: "#56632c"
(n10 -> n14)[0].style.stroke-dash: 0
n15.style.stroke: "#535b60"
n15.style.stroke-width: 2
n15.style.fill: "#e4e4df"
n15.style.font-color: "#18232d"
(n11 -> n15)[0].style.stroke: "#535b60"
(n11 -> n15)[0].style.stroke-width: 3
(n11 -> n15)[0].style.font-color: "#535b60"
(n11 -> n15)[0].style.stroke-dash: 0
n16.style.stroke: "#006b7c"
n16.style.stroke-width: 2
n16.style.fill: "#dae6e3"
n16.style.font-color: "#18232d"
(n12 -> n16)[0].style.stroke: "#006b7c"
(n12 -> n16)[0].style.stroke-width: 3
(n12 -> n16)[0].style.font-color: "#006b7c"
(n12 -> n16)[0].style.stroke-dash: 3
n17.style.stroke: "#8b5100"
n17.style.stroke-width: 2
n17.style.fill: "#ece2d3"
n17.style.font-color: "#18232d"
(n13 -> n17)[0].style.stroke: "#8b5100"
(n13 -> n17)[0].style.stroke-width: 3
(n13 -> n17)[0].style.font-color: "#8b5100"
(n13 -> n17)[0].style.stroke-dash: 3
n18.style.stroke: "#215ea8"
n18.style.stroke-width: 2
n18.style.fill: "#dee4e8"
n18.style.font-color: "#18232d"
(n14 -> n18)[0].style.stroke: "#215ea8"
(n14 -> n18)[0].style.stroke-width: 3
(n14 -> n18)[0].style.font-color: "#215ea8"
(n14 -> n18)[0].style.stroke-dash: 3
n19.style.stroke: "#376b21"
n19.style.stroke-width: 2
n19.style.fill: "#e1e6d7"
n19.style.font-color: "#18232d"
(n15 -> n19)[0].style.stroke: "#376b21"
(n15 -> n19)[0].style.stroke-width: 3
(n15 -> n19)[0].style.font-color: "#376b21"
(n15 -> n19)[0].style.stroke-dash: 3
```

## midnight / clear / shuffle

```d2
vars: { d2-config: { layout-engine: dagre; pad: 32 } }
direction: down
n0: "Group 01"
n1: "Group 02"
n2: "Group 03"
n3: "Group 04"
n4: "Group 05"
n0 -> n4: "Group 05"
n5: "Group 06"
n1 -> n5: "Group 06"
n6: "Group 07"
n2 -> n6: "Group 07"
n7: "Group 08"
n3 -> n7: "Group 08"
n8: "Group 09"
n4 -> n8: "Group 09"
n9: "Group 10"
n5 -> n9: "Group 10"
n10: "Group 11"
n6 -> n10: "Group 11"
n11: "Group 12"
n7 -> n11: "Group 12"
n12: "Group 13"
n8 -> n12: "Group 13"
n13: "Group 14"
n9 -> n13: "Group 14"
n14: "Group 15"
n10 -> n14: "Group 15"
n15: "Group 16"
n11 -> n15: "Group 16"
n16: "Group 17"
n12 -> n16: "Group 17"
n17: "Group 18"
n13 -> n17: "Group 18"
n18: "Group 19"
n14 -> n18: "Group 19"
n19: "Group 20"
n15 -> n19: "Group 20"

# D2 theme kit: midnight / clear
vars: { d2-config: { theme-id: 200; theme-overrides: { N1: "#edf3f8"; N2: "#edf3f8"; N3: "#edf3f8"; N4: "#b8b7f1"; N5: "#1d252d"; N6: "#1d252d"; N7: "#101820"; B1: "#73c8ff"; B2: "#73c8ff"; B3: "#73c8ff"; B4: "#1d252d"; B5: "#1d252d"; B6: "#1d252d"; AA2: "#ffc66d"; AA4: "#1d252d"; AA5: "#1d252d"; AB4: "#1d252d"; AB5: "#1d252d" } } }
style.fill: "#101820"
classes: {
  kit_c0: { style.fill: "#1d2f3d"; style.stroke: "#73c8ff"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c0: { style.stroke: "#73c8ff"; style.font-color: "#73c8ff"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c1: { style.fill: "#2f2e29"; style.stroke: "#ffbf69"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c1: { style.stroke: "#ffbf69"; style.font-color: "#ffbf69"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c2: { style.fill: "#1d3134"; style.stroke: "#74d9bb"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c2: { style.stroke: "#74d9bb"; style.font-color: "#74d9bb"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c3: { style.fill: "#2f292d"; style.stroke: "#ff9784"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c3: { style.stroke: "#ff9784"; style.font-color: "#ff9784"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c4: { style.fill: "#2c312e"; style.stroke: "#e4d888"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c4: { style.stroke: "#e4d888"; style.font-color: "#e4d888"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c5: { style.fill: "#272f38"; style.stroke: "#c2cbd5"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c5: { style.stroke: "#c2cbd5"; style.font-color: "#c2cbd5"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c6: { style.fill: "#26312e"; style.stroke: "#b6da89"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c6: { style.stroke: "#b6da89"; style.font-color: "#b6da89"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_c7: { style.fill: "#262d3b"; style.stroke: "#b8b7f1"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_c7: { style.stroke: "#b8b7f1"; style.font-color: "#b8b7f1"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_data: { style.fill: "#1b313a"; style.stroke: "#67d5e8"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_data: { style.stroke: "#67d5e8"; style.font-color: "#67d5e8"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_control: { style.fill: "#2f2f2a"; style.stroke: "#ffc66d"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_control: { style.stroke: "#ffc66d"; style.font-color: "#ffc66d"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_identity: { style.fill: "#212e3d"; style.stroke: "#91c4ff"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_identity: { style.stroke: "#91c4ff"; style.font-color: "#91c4ff"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_success: { style.fill: "#23312d"; style.stroke: "#a5dc83"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_success: { style.stroke: "#a5dc83"; style.font-color: "#a5dc83"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_failure: { style.fill: "#2f292d"; style.stroke: "#ff9784"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_failure: { style.stroke: "#ff9784"; style.font-color: "#ff9784"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_warning: { style.fill: "#2c302d"; style.stroke: "#e5d482"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_warning: { style.stroke: "#e5d482"; style.font-color: "#e5d482"; style.stroke-width: 3; style.stroke-dash: 3 }
  kit_storage: { style.fill: "#1d3133"; style.stroke: "#75d9b0"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_storage: { style.stroke: "#75d9b0"; style.font-color: "#75d9b0"; style.stroke-width: 3; style.stroke-dash: 0 }
  kit_inactive: { style.fill: "#272f39"; style.stroke: "#c0cce0"; style.font-color: "#edf3f8"; style.stroke-width: 2 }
  kit_edge_inactive: { style.stroke: "#c0cce0"; style.font-color: "#c0cce0"; style.stroke-width: 3; style.stroke-dash: 5 }
}

# Explicit group assignments
n0.style.stroke: "#c2cbd5"
n0.style.stroke-width: 2
n0.style.fill: "#272f38"
n0.style.font-color: "#edf3f8"
n1.style.stroke: "#b8b7f1"
n1.style.stroke-width: 2
n1.style.fill: "#262d3b"
n1.style.font-color: "#edf3f8"
n2.style.stroke: "#b6da89"
n2.style.stroke-width: 2
n2.style.fill: "#26312e"
n2.style.font-color: "#edf3f8"
n3.style.stroke: "#e4d888"
n3.style.stroke-width: 2
n3.style.fill: "#2c312e"
n3.style.font-color: "#edf3f8"
n4.style.stroke: "#ffbf69"
n4.style.stroke-width: 2
n4.style.fill: "#2f2e29"
n4.style.font-color: "#edf3f8"
(n0 -> n4)[0].style.stroke: "#ffbf69"
(n0 -> n4)[0].style.stroke-width: 3
(n0 -> n4)[0].style.font-color: "#ffbf69"
(n0 -> n4)[0].style.stroke-dash: 0
n5.style.stroke: "#ff9784"
n5.style.stroke-width: 2
n5.style.fill: "#2f292d"
n5.style.font-color: "#edf3f8"
(n1 -> n5)[0].style.stroke: "#ff9784"
(n1 -> n5)[0].style.stroke-width: 3
(n1 -> n5)[0].style.font-color: "#ff9784"
(n1 -> n5)[0].style.stroke-dash: 0
n6.style.stroke: "#73c8ff"
n6.style.stroke-width: 2
n6.style.fill: "#1d2f3d"
n6.style.font-color: "#edf3f8"
(n2 -> n6)[0].style.stroke: "#73c8ff"
(n2 -> n6)[0].style.stroke-width: 3
(n2 -> n6)[0].style.font-color: "#73c8ff"
(n2 -> n6)[0].style.stroke-dash: 0
n7.style.stroke: "#74d9bb"
n7.style.stroke-width: 2
n7.style.fill: "#1d3134"
n7.style.font-color: "#edf3f8"
(n3 -> n7)[0].style.stroke: "#74d9bb"
(n3 -> n7)[0].style.stroke-width: 3
(n3 -> n7)[0].style.font-color: "#74d9bb"
(n3 -> n7)[0].style.stroke-dash: 0
n8.style.stroke: "#c2cbd5"
n8.style.stroke-width: 2
n8.style.fill: "#272f38"
n8.style.font-color: "#edf3f8"
(n4 -> n8)[0].style.stroke: "#c2cbd5"
(n4 -> n8)[0].style.stroke-width: 3
(n4 -> n8)[0].style.font-color: "#c2cbd5"
(n4 -> n8)[0].style.stroke-dash: 3
n9.style.stroke: "#b8b7f1"
n9.style.stroke-width: 2
n9.style.fill: "#262d3b"
n9.style.font-color: "#edf3f8"
(n5 -> n9)[0].style.stroke: "#b8b7f1"
(n5 -> n9)[0].style.stroke-width: 3
(n5 -> n9)[0].style.font-color: "#b8b7f1"
(n5 -> n9)[0].style.stroke-dash: 3
n10.style.stroke: "#b6da89"
n10.style.stroke-width: 2
n10.style.fill: "#26312e"
n10.style.font-color: "#edf3f8"
(n6 -> n10)[0].style.stroke: "#b6da89"
(n6 -> n10)[0].style.stroke-width: 3
(n6 -> n10)[0].style.font-color: "#b6da89"
(n6 -> n10)[0].style.stroke-dash: 3
n11.style.stroke: "#e4d888"
n11.style.stroke-width: 2
n11.style.fill: "#2c312e"
n11.style.font-color: "#edf3f8"
(n7 -> n11)[0].style.stroke: "#e4d888"
(n7 -> n11)[0].style.stroke-width: 3
(n7 -> n11)[0].style.font-color: "#e4d888"
(n7 -> n11)[0].style.stroke-dash: 3
n12.style.stroke: "#ffbf69"
n12.style.stroke-width: 2
n12.style.fill: "#2f2e29"
n12.style.font-color: "#edf3f8"
(n8 -> n12)[0].style.stroke: "#ffbf69"
(n8 -> n12)[0].style.stroke-width: 3
(n8 -> n12)[0].style.font-color: "#ffbf69"
(n8 -> n12)[0].style.stroke-dash: 3
n13.style.stroke: "#ff9784"
n13.style.stroke-width: 2
n13.style.fill: "#2f292d"
n13.style.font-color: "#edf3f8"
(n9 -> n13)[0].style.stroke: "#ff9784"
(n9 -> n13)[0].style.stroke-width: 3
(n9 -> n13)[0].style.font-color: "#ff9784"
(n9 -> n13)[0].style.stroke-dash: 3
n14.style.stroke: "#73c8ff"
n14.style.stroke-width: 2
n14.style.fill: "#1d2f3d"
n14.style.font-color: "#edf3f8"
(n10 -> n14)[0].style.stroke: "#73c8ff"
(n10 -> n14)[0].style.stroke-width: 3
(n10 -> n14)[0].style.font-color: "#73c8ff"
(n10 -> n14)[0].style.stroke-dash: 3
n15.style.stroke: "#74d9bb"
n15.style.stroke-width: 2
n15.style.fill: "#1d3134"
n15.style.font-color: "#edf3f8"
(n11 -> n15)[0].style.stroke: "#74d9bb"
(n11 -> n15)[0].style.stroke-width: 3
(n11 -> n15)[0].style.font-color: "#74d9bb"
(n11 -> n15)[0].style.stroke-dash: 3
n16.style.stroke: "#c2cbd5"
n16.style.stroke-width: 2
n16.style.fill: "#272f38"
n16.style.font-color: "#edf3f8"
(n12 -> n16)[0].style.stroke: "#c2cbd5"
(n12 -> n16)[0].style.stroke-width: 3
(n12 -> n16)[0].style.font-color: "#c2cbd5"
(n12 -> n16)[0].style.stroke-dash: 6
n17.style.stroke: "#b8b7f1"
n17.style.stroke-width: 2
n17.style.fill: "#262d3b"
n17.style.font-color: "#edf3f8"
(n13 -> n17)[0].style.stroke: "#b8b7f1"
(n13 -> n17)[0].style.stroke-width: 3
(n13 -> n17)[0].style.font-color: "#b8b7f1"
(n13 -> n17)[0].style.stroke-dash: 6
n18.style.stroke: "#b6da89"
n18.style.stroke-width: 2
n18.style.fill: "#26312e"
n18.style.font-color: "#edf3f8"
(n14 -> n18)[0].style.stroke: "#b6da89"
(n14 -> n18)[0].style.stroke-width: 3
(n14 -> n18)[0].style.font-color: "#b6da89"
(n14 -> n18)[0].style.stroke-dash: 6
n19.style.stroke: "#e4d888"
n19.style.stroke-width: 2
n19.style.fill: "#2c312e"
n19.style.font-color: "#edf3f8"
(n15 -> n19)[0].style.stroke: "#e4d888"
(n15 -> n19)[0].style.stroke-width: 3
(n15 -> n19)[0].style.font-color: "#e4d888"
(n15 -> n19)[0].style.stroke-dash: 6
```
