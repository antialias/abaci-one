import{j as t,a as e,u as z,A as N}from"./AbacusReact-1f2a91b6.js";import{r as c}from"./index-76fb7be0.js";import"./index-d3ea75b5.js";import"./_commonjsHelpers-de833af9.js";const m=[{id:"basic-5",title:"Basic Number 5",subtitle:"Simple representation of 5",value:5,config:{columns:1,beadShape:"diamond",colorScheme:"monochrome",scaleFactor:1,animated:!0,draggable:!0}},{id:"colorful-123",title:"Colorful 123",subtitle:"Multi-column with place value colors",value:123,config:{columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:1,animated:!0,draggable:!0}},{id:"circles-42",title:"Circle Beads - 42",subtitle:"Different bead shape demonstration",value:42,config:{columns:2,beadShape:"circle",colorScheme:"place-value",colorPalette:"default",scaleFactor:1.2,animated:!0,draggable:!0}},{id:"large-7",title:"Large Scale - 7",subtitle:"Larger scale for better visibility",value:7,config:{columns:1,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:2,animated:!0,draggable:!0}},{id:"compact-999",title:"Compact 999",subtitle:"Square beads with alternating colors",value:999,config:{columns:3,beadShape:"square",colorScheme:"alternating",scaleFactor:.8,animated:!0,draggable:!0}},{id:"educational-1234",title:"Educational 1234",subtitle:"Four-digit educational example",value:1234,config:{columns:4,beadShape:"circle",colorScheme:"place-value",colorPalette:"mnemonic",scaleFactor:.9,animated:!0,draggable:!0}},{id:"crop-single-1",title:"Single Digit",subtitle:"Minimal single column design",value:1,config:{columns:1,beadShape:"diamond",colorScheme:"monochrome",scaleFactor:.8,animated:!0,draggable:!0}},{id:"crop-quad-9999",title:"Four 9s",subtitle:"Maximum value demonstration",value:9999,config:{columns:4,beadShape:"diamond",colorScheme:"place-value",colorPalette:"colorblind",scaleFactor:.9,animated:!0,draggable:!0}},{id:"crop-large-scale-0",title:"Large Zero",subtitle:"Empty abacus representation",value:0,config:{columns:1,beadShape:"circle",colorScheme:"monochrome",scaleFactor:2,hideInactiveBeads:!1,animated:!0,draggable:!0}},{id:"crop-hidden-inactive-555",title:"Hidden Inactive",subtitle:"Clean look with hidden inactive beads",value:555,config:{columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"nature",hideInactiveBeads:!0,scaleFactor:1.4,animated:!0,draggable:!0}},{id:"crop-mixed-geometry-321",title:"Mixed Geometry",subtitle:"Demonstrating various configurations",value:321,config:{columns:3,beadShape:"circle",colorScheme:"place-value",colorPalette:"colorblind",scaleFactor:1.1,animated:!0,draggable:!0}},{id:"debug-89",title:"Debug: 89",subtitle:"Two-digit debugging example",value:89,config:{columns:2,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:1,animated:!0,draggable:!0}},{id:"debug-456",title:"Debug: 456",subtitle:"Three-digit debugging example",value:456,config:{columns:3,beadShape:"circle",colorScheme:"place-value",colorPalette:"default",scaleFactor:.8,animated:!0,draggable:!0}}],G=({example:a,onValueChange:o,onBeadClick:i})=>{const[r,n]=c.useState(a.value),[s,g]=c.useState(0),p=z(a.config.columns==="auto"?Math.max(1,r.toString().length):a.config.columns,a.config.scaleFactor||1),l=c.useCallback(u=>{n(u),o==null||o(u)},[o]),d=c.useCallback(u=>{g(D=>D+1),i==null||i(u)},[i]),A=c.useCallback(()=>{n(a.value),g(0)},[a.value]);return t("div",{className:"gallery-card",children:[t("div",{className:"card-header",children:[t("div",{className:"card-title",children:[e("h3",{children:a.title}),e("p",{children:a.subtitle})]}),t("div",{className:"card-controls",children:[t("div",{className:"value-display",children:["Value: ",e("strong",{children:r})]}),t("div",{className:"interaction-stats",children:["Clicks: ",e("strong",{children:s})]}),e("button",{className:"reset-btn",onClick:A,title:"Reset to original value",children:"↻"})]})]}),e("div",{className:"card-content",children:e("div",{className:"abacus-container",style:{width:`${p.width}px`,height:`${p.height}px`,margin:"0 auto"},children:e(N,{value:r,...a.config,onClick:d,onValueChange:l})})}),e("div",{className:"card-footer",children:t("div",{className:"config-info",children:[e("span",{className:"config-tag",children:a.config.beadShape}),e("span",{className:"config-tag",children:a.config.colorScheme}),t("span",{className:"config-tag",children:["×",a.config.scaleFactor]})]})})]})},L=()=>{const[a,o]=c.useState("basic"),[i,r]=c.useState({totalClicks:0,totalValueChanges:0,activeExample:null}),n={basic:m.filter(l=>["basic-5","colorful-123","circles-42","large-7"].includes(l.id)),advanced:m.filter(l=>["compact-999","educational-1234","crop-hidden-inactive-555","crop-mixed-geometry-321"].includes(l.id)),debug:m.filter(l=>["crop-single-1","crop-quad-9999","crop-large-scale-0","debug-89","debug-456"].includes(l.id))},s=c.useCallback(l=>{r(d=>({...d,totalValueChanges:d.totalValueChanges+1}))},[]),g=c.useCallback(l=>{r(d=>({...d,totalClicks:d.totalClicks+1}))},[]),p=n[a];return t("div",{className:"interactive-gallery",children:[e("style",{children:`
        .interactive-gallery {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background: #f5f5f5;
          padding: 20px;
          min-height: 100vh;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .header {
          text-align: center;
          margin-bottom: 40px;
          padding: 40px 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .header h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
          color: #2c3e50;
        }

        .header p {
          font-size: 1.1rem;
          color: #666;
          margin-bottom: 20px;
        }

        .stats {
          background: white;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          text-align: center;
        }

        .stats-info {
          color: #666;
          font-size: 0.9rem;
        }

        .global-stats {
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-top: 10px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .tabs {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
          margin-bottom: 30px;
        }

        .tab-nav {
          display: flex;
          border-bottom: 1px solid #eee;
        }

        .tab-button {
          flex: 1;
          padding: 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          font-weight: 600;
          color: #666;
          transition: all 0.3s;
          position: relative;
        }

        .tab-button:hover {
          background: #f8f9fa;
          color: #333;
        }

        .tab-button.active {
          color: #2c3e50;
          background: #f8f9fa;
        }

        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #3498db;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 30px;
          padding: 30px;
        }

        .gallery-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .gallery-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .card-header {
          padding: 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .card-title h3 {
          margin: 0 0 5px 0;
          color: #2c3e50;
          font-size: 1.3rem;
        }

        .card-title p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }

        .card-controls {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
        }

        .value-display, .interaction-stats {
          font-size: 0.85rem;
          color: #666;
        }

        .reset-btn {
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 5px 10px;
          cursor: pointer;
          font-size: 1.2rem;
          transition: background 0.2s;
        }

        .reset-btn:hover {
          background: #2980b9;
        }

        .card-content {
          padding: 30px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          background: #fafafa;
        }

        .abacus-container {
          border: 2px solid rgba(0,0,0,0.1);
          border-radius: 8px;
          background: white;
          padding: 10px;
        }

        .card-footer {
          padding: 15px 20px;
          background: #f8f9fa;
          border-top: 1px solid #eee;
        }

        .config-info {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .config-tag {
          background: #e9ecef;
          color: #495057;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .tutorial-box {
          background: #e8f4fd;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          text-align: center;
        }

        .tutorial-box h3 {
          color: #0c5460;
          margin-bottom: 10px;
        }

        .tutorial-box p {
          color: #0c5460;
          margin: 0;
        }

        @media (max-width: 768px) {
          .gallery-grid {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .card-header {
            flex-direction: column;
            align-items: stretch;
            gap: 15px;
          }

          .card-controls {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
        }
      `}),t("div",{className:"container",children:[t("div",{className:"header",children:[e("h1",{children:"🧮 Interactive Soroban Gallery"}),e("p",{children:"Click and drag the beads to explore how a Japanese abacus works!"}),t("div",{className:"global-stats",children:[t("div",{className:"stat-item",children:[e("span",{children:"Total Interactions:"}),e("strong",{children:i.totalClicks})]}),t("div",{className:"stat-item",children:[e("span",{children:"Value Changes:"}),e("strong",{children:i.totalValueChanges})]})]})]}),e("div",{className:"stats",children:t("div",{className:"stats-info",children:[e("strong",{children:m.length})," interactive examples • All abaci are fully interactive with drag and click support • Generated with React + TypeScript"]})}),t("div",{className:"tutorial-box",children:[e("h3",{children:"🎯 How to Interact"}),t("p",{children:[e("strong",{children:"Click"})," beads to toggle their positions • ",e("strong",{children:"Drag"})," beads for tactile feedback •",e("strong",{children:"Reset"})," button restores original values • Each interaction updates the value in real-time"]})]}),t("div",{className:"tabs",children:[t("div",{className:"tab-nav",children:[e("button",{className:`tab-button ${a==="basic"?"active":""}`,onClick:()=>o("basic"),children:"📚 Basic Examples"}),e("button",{className:`tab-button ${a==="advanced"?"active":""}`,onClick:()=>o("advanced"),children:"🎨 Advanced Features"}),e("button",{className:`tab-button ${a==="debug"?"active":""}`,onClick:()=>o("debug"),children:"🔧 Debug & Edge Cases"})]}),e("div",{className:"gallery-grid",children:p.map(l=>e(G,{example:l,onValueChange:s,onBeadClick:g},l.id))})]})]})]})},P={title:"Soroban/Interactive Gallery",component:L,parameters:{layout:"fullscreen",docs:{description:{component:`
# Interactive Soroban Gallery

A complete gallery showcasing all the interactive abacus components with identical structure to the original Typst-generated gallery, but with full React interactivity.

## Features

- 📚 **Complete Example Set**: All 13 examples from the original gallery
- 🎯 **Fully Interactive**: Every abacus responds to clicks and drags
- 📊 **Live Statistics**: Real-time tracking of interactions and value changes
- 🗂️ **Organized Tabs**: Basic Examples, Advanced Features, Debug & Edge Cases
- 🔄 **Reset Functionality**: Each card has a reset button to restore original values
- 📱 **Responsive Design**: Adapts to different screen sizes

## Gallery Examples

### Basic Examples
- **Basic Number 5**: Simple single-column representation
- **Colorful 123**: Multi-column with place-value colors
- **Circle Beads 42**: Different bead shape demonstration
- **Large Scale 7**: Enlarged for better visibility

### Advanced Features
- **Compact 999**: Square beads with alternating colors
- **Educational 1234**: Four-digit educational example
- **Hidden Inactive 555**: Clean look with hidden inactive beads
- **Mixed Geometry 321**: Various configuration demonstration

### Debug & Edge Cases
- **Single Digit**: Minimal single column design
- **Four 9s**: Maximum value demonstration (9999)
- **Large Zero**: Empty abacus representation
- **Debug Examples**: Two and three-digit debugging cases

## Interaction Guide

- **Click** beads to toggle their positions
- **Drag** beads for tactile feedback (they snap back)
- **Reset** button restores original values
- **Statistics** track total interactions across all examples
        `}}},tags:["autodocs"]},b={parameters:{docs:{description:{story:"Complete interactive gallery with all examples. Try clicking and dragging beads in any of the abacus components!"}}}},h={render:()=>t("div",{style:{padding:"40px",maxWidth:"1200px",margin:"0 auto",fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'},children:[t("div",{style:{textAlign:"center",marginBottom:"40px"},children:[e("h1",{style:{fontSize:"2.5rem",color:"#2c3e50",marginBottom:"10px"},children:"🧮 Interactive Soroban Gallery"}),e("p",{style:{fontSize:"1.1rem",color:"#666",marginBottom:"30px"},children:"Explore the complete collection of interactive Japanese abacus components"})]}),t("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:"30px",marginBottom:"40px"},children:[t("div",{style:{background:"white",padding:"20px",borderRadius:"12px",boxShadow:"0 4px 15px rgba(0,0,0,0.1)"},children:[e("h3",{style:{color:"#3498db",marginBottom:"15px"},children:"📚 Basic Examples"}),t("ul",{style:{color:"#666",lineHeight:1.8,paddingLeft:"20px"},children:[e("li",{children:"Basic Number 5 - Simple single column"}),e("li",{children:"Colorful 123 - Place-value colors"}),e("li",{children:"Circle Beads 42 - Alternative bead shapes"}),e("li",{children:"Large Scale 7 - Enhanced visibility"})]})]}),t("div",{style:{background:"white",padding:"20px",borderRadius:"12px",boxShadow:"0 4px 15px rgba(0,0,0,0.1)"},children:[e("h3",{style:{color:"#e74c3c",marginBottom:"15px"},children:"🎨 Advanced Features"}),t("ul",{style:{color:"#666",lineHeight:1.8,paddingLeft:"20px"},children:[e("li",{children:"Compact 999 - Square beads"}),e("li",{children:"Educational 1234 - Four-digit example"}),e("li",{children:"Hidden Inactive 555 - Clean design"}),e("li",{children:"Mixed Geometry 321 - Various configs"})]})]}),t("div",{style:{background:"white",padding:"20px",borderRadius:"12px",boxShadow:"0 4px 15px rgba(0,0,0,0.1)"},children:[e("h3",{style:{color:"#f39c12",marginBottom:"15px"},children:"🔧 Debug & Edge Cases"}),t("ul",{style:{color:"#666",lineHeight:1.8,paddingLeft:"20px"},children:[e("li",{children:"Single Digit - Minimal design"}),e("li",{children:"Four 9s - Maximum value (9999)"}),e("li",{children:"Large Zero - Empty state"}),e("li",{children:"Debug Examples - Testing cases"})]})]})]}),t("div",{style:{background:"#e8f4fd",border:"1px solid #bee5eb",borderRadius:"8px",padding:"20px",textAlign:"center",marginBottom:"30px"},children:[e("h3",{style:{color:"#0c5460",marginBottom:"10px"},children:"🎯 Interactive Features"}),t("p",{style:{color:"#0c5460",margin:0,lineHeight:1.6},children:[e("strong",{children:"Click"})," beads to toggle positions •",e("strong",{children:"Drag"})," beads for tactile feedback •",e("strong",{children:"Reset"})," buttons restore original values •",e("strong",{children:"Live statistics"})," track all interactions"]})]}),e("div",{style:{textAlign:"center"},children:e("button",{onClick:()=>window.location.reload(),style:{background:"#3498db",color:"white",border:"none",borderRadius:"8px",padding:"12px 24px",fontSize:"1rem",cursor:"pointer",boxShadow:"0 2px 8px rgba(52, 152, 219, 0.3)",transition:"all 0.2s"},onMouseOver:a=>{a.currentTarget.style.background="#2980b9",a.currentTarget.style.transform="translateY(-2px)"},onMouseOut:a=>{a.currentTarget.style.background="#3498db",a.currentTarget.style.transform="translateY(0)"},children:"🧮 Launch Full Interactive Gallery"})}),t("div",{style:{marginTop:"40px",padding:"20px",background:"#f8f9fa",borderRadius:"8px",border:"1px solid #e9ecef"},children:[e("h4",{style:{color:"#495057",marginBottom:"15px"},children:"🚀 Implementation Details"}),t("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(250px, 1fr))",gap:"15px",fontSize:"0.9rem",color:"#6c757d"},children:[t("div",{children:[e("strong",{children:"Framework:"})," React + TypeScript",e("br",{}),e("strong",{children:"Animations:"})," React Spring",e("br",{}),e("strong",{children:"Interactions:"})," @use-gesture/react"]}),t("div",{children:[e("strong",{children:"Rendering:"})," Pure SVG (no external libs)",e("br",{}),e("strong",{children:"State:"})," Custom hooks",e("br",{}),e("strong",{children:"Accessibility:"})," Colorblind-friendly palettes"]})]})]})]}),parameters:{docs:{description:{story:"Overview of all gallery features and organization. This gives you a preview of what's available in the full gallery."}}}},x={render:()=>{const[a,o]=c.useState("basic"),i={basic:{title:"📚 Basic Examples",description:"Simple demonstrations of core functionality",examples:["Basic Number 5","Colorful 123","Circle Beads 42","Large Scale 7"]},advanced:{title:"🎨 Advanced Features",description:"Complex configurations and styling options",examples:["Compact 999","Educational 1234","Hidden Inactive 555","Mixed Geometry 321"]},debug:{title:"🔧 Debug & Edge Cases",description:"Testing scenarios and boundary conditions",examples:["Single Digit","Four 9s (9999)","Large Zero","Debug Examples"]}};return t("div",{style:{fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',maxWidth:"800px",margin:"0 auto",padding:"20px"},children:[e("h2",{style:{textAlign:"center",color:"#2c3e50",marginBottom:"30px"},children:"Gallery Tab System Demo"}),t("div",{style:{background:"white",borderRadius:"12px",boxShadow:"0 4px 15px rgba(0,0,0,0.1)",overflow:"hidden"},children:[e("div",{style:{display:"flex",borderBottom:"1px solid #eee"},children:Object.entries(i).map(([r,n])=>t("button",{onClick:()=>o(r),style:{flex:1,padding:"20px",background:a===r?"#f8f9fa":"none",border:"none",cursor:"pointer",fontSize:"1.1rem",fontWeight:"600",color:a===r?"#2c3e50":"#666",transition:"all 0.3s",position:"relative"},children:[n.title,a===r&&e("div",{style:{position:"absolute",bottom:0,left:0,right:0,height:"3px",background:"#3498db"}})]},r))}),t("div",{style:{padding:"30px"},children:[e("h3",{style:{color:"#2c3e50",marginBottom:"15px"},children:i[a].title}),e("p",{style:{color:"#666",marginBottom:"20px",lineHeight:1.6},children:i[a].description}),t("div",{style:{background:"#f8f9fa",padding:"20px",borderRadius:"8px",border:"1px solid #e9ecef"},children:[e("h4",{style:{color:"#495057",marginBottom:"15px"},children:"Examples in this section:"}),e("ul",{style:{color:"#6c757d",lineHeight:1.8,paddingLeft:"20px"},children:i[a].examples.map((r,n)=>e("li",{children:r},n))})]})]})]}),e("div",{style:{marginTop:"20px",padding:"15px",background:"#e8f4fd",borderRadius:"8px",textAlign:"center"},children:t("p",{style:{color:"#0c5460",margin:0},children:["💡 ",e("strong",{children:"Tip:"})," In the full gallery, each tab contains interactive abacus components that you can click and drag to explore different values and configurations."]})})]})},parameters:{docs:{description:{story:"Demonstration of the tab system used to organize gallery examples into logical groups."}}}},v={render:()=>{const[a,o]=c.useState({totalClicks:0,valueChanges:0,activeInteractions:0}),i=n=>{o(s=>({...s,totalClicks:n==="click"?s.totalClicks+1:s.totalClicks,valueChanges:n==="value"?s.valueChanges+1:s.valueChanges,activeInteractions:n==="active"?s.activeInteractions+1:s.activeInteractions}))},r=()=>{o({totalClicks:0,valueChanges:0,activeInteractions:0})};return t("div",{style:{fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',maxWidth:"600px",margin:"0 auto",padding:"20px"},children:[e("h2",{style:{textAlign:"center",color:"#2c3e50",marginBottom:"30px"},children:"Statistics Tracking Demo"}),t("div",{style:{background:"white",padding:"30px",borderRadius:"12px",boxShadow:"0 4px 15px rgba(0,0,0,0.1)",textAlign:"center",marginBottom:"20px"},children:[e("h3",{style:{color:"#2c3e50",marginBottom:"20px"},children:"Live Gallery Statistics"}),t("div",{style:{display:"flex",justifyContent:"center",gap:"30px",marginBottom:"30px",flexWrap:"wrap"},children:[t("div",{style:{textAlign:"center"},children:[e("div",{style:{fontSize:"2rem",fontWeight:"bold",color:"#3498db"},children:a.totalClicks}),e("div",{style:{color:"#666",fontSize:"0.9rem"},children:"Total Bead Clicks"})]}),t("div",{style:{textAlign:"center"},children:[e("div",{style:{fontSize:"2rem",fontWeight:"bold",color:"#e74c3c"},children:a.valueChanges}),e("div",{style:{color:"#666",fontSize:"0.9rem"},children:"Value Changes"})]}),t("div",{style:{textAlign:"center"},children:[e("div",{style:{fontSize:"2rem",fontWeight:"bold",color:"#f39c12"},children:a.activeInteractions}),e("div",{style:{color:"#666",fontSize:"0.9rem"},children:"Active Sessions"})]})]}),t("div",{style:{display:"flex",gap:"10px",justifyContent:"center",marginBottom:"20px",flexWrap:"wrap"},children:[e("button",{onClick:()=>i("click"),style:{background:"#3498db",color:"white",border:"none",padding:"8px 16px",borderRadius:"4px",cursor:"pointer"},children:"Simulate Click"}),e("button",{onClick:()=>i("value"),style:{background:"#e74c3c",color:"white",border:"none",padding:"8px 16px",borderRadius:"4px",cursor:"pointer"},children:"Simulate Value Change"}),e("button",{onClick:()=>i("active"),style:{background:"#f39c12",color:"white",border:"none",padding:"8px 16px",borderRadius:"4px",cursor:"pointer"},children:"Simulate Interaction"}),e("button",{onClick:r,style:{background:"#95a5a6",color:"white",border:"none",padding:"8px 16px",borderRadius:"4px",cursor:"pointer"},children:"Reset"})]})]}),t("div",{style:{background:"#e8f4fd",padding:"20px",borderRadius:"8px",border:"1px solid #bee5eb"},children:[e("h4",{style:{color:"#0c5460",marginBottom:"15px"},children:"📊 What Gets Tracked"}),t("ul",{style:{color:"#0c5460",lineHeight:1.8,paddingLeft:"20px"},children:[t("li",{children:[e("strong",{children:"Bead Clicks:"})," Every time a user clicks on any bead"]}),t("li",{children:[e("strong",{children:"Value Changes:"})," When the numeric value of an abacus changes"]}),t("li",{children:[e("strong",{children:"Active Sessions:"})," Ongoing interactions across all examples"]}),t("li",{children:[e("strong",{children:"Per-Card Stats:"})," Individual reset counters and click counts"]})]})]})]})},parameters:{docs:{description:{story:"Demonstration of the real-time statistics tracking system that monitors user interactions across the entire gallery."}}}};var f,y,S;b.parameters={...b.parameters,docs:{...(f=b.parameters)==null?void 0:f.docs,source:{originalSource:`{
  parameters: {
    docs: {
      description: {
        story: 'Complete interactive gallery with all examples. Try clicking and dragging beads in any of the abacus components!'
      }
    }
  }
}`,...(S=(y=b.parameters)==null?void 0:y.docs)==null?void 0:S.source}}};var k,C,w;h.parameters={...h.parameters,docs:{...(k=h.parameters)==null?void 0:k.docs,source:{originalSource:`{
  render: () => {
    return <div style={{
      padding: '40px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
        <div style={{
        textAlign: 'center',
        marginBottom: '40px'
      }}>
          <h1 style={{
          fontSize: '2.5rem',
          color: '#2c3e50',
          marginBottom: '10px'
        }}>
            🧮 Interactive Soroban Gallery
          </h1>
          <p style={{
          fontSize: '1.1rem',
          color: '#666',
          marginBottom: '30px'
        }}>
            Explore the complete collection of interactive Japanese abacus components
          </p>
        </div>

        <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '30px',
        marginBottom: '40px'
      }}>
          <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{
            color: '#3498db',
            marginBottom: '15px'
          }}>📚 Basic Examples</h3>
            <ul style={{
            color: '#666',
            lineHeight: 1.8,
            paddingLeft: '20px'
          }}>
              <li>Basic Number 5 - Simple single column</li>
              <li>Colorful 123 - Place-value colors</li>
              <li>Circle Beads 42 - Alternative bead shapes</li>
              <li>Large Scale 7 - Enhanced visibility</li>
            </ul>
          </div>

          <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{
            color: '#e74c3c',
            marginBottom: '15px'
          }}>🎨 Advanced Features</h3>
            <ul style={{
            color: '#666',
            lineHeight: 1.8,
            paddingLeft: '20px'
          }}>
              <li>Compact 999 - Square beads</li>
              <li>Educational 1234 - Four-digit example</li>
              <li>Hidden Inactive 555 - Clean design</li>
              <li>Mixed Geometry 321 - Various configs</li>
            </ul>
          </div>

          <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{
            color: '#f39c12',
            marginBottom: '15px'
          }}>🔧 Debug & Edge Cases</h3>
            <ul style={{
            color: '#666',
            lineHeight: 1.8,
            paddingLeft: '20px'
          }}>
              <li>Single Digit - Minimal design</li>
              <li>Four 9s - Maximum value (9999)</li>
              <li>Large Zero - Empty state</li>
              <li>Debug Examples - Testing cases</li>
            </ul>
          </div>
        </div>

        <div style={{
        background: '#e8f4fd',
        border: '1px solid #bee5eb',
        borderRadius: '8px',
        padding: '20px',
        textAlign: 'center',
        marginBottom: '30px'
      }}>
          <h3 style={{
          color: '#0c5460',
          marginBottom: '10px'
        }}>🎯 Interactive Features</h3>
          <p style={{
          color: '#0c5460',
          margin: 0,
          lineHeight: 1.6
        }}>
            <strong>Click</strong> beads to toggle positions •
            <strong>Drag</strong> beads for tactile feedback •
            <strong>Reset</strong> buttons restore original values •
            <strong>Live statistics</strong> track all interactions
          </p>
        </div>

        <div style={{
        textAlign: 'center'
      }}>
          <button onClick={() => window.location.reload()} style={{
          background: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '12px 24px',
          fontSize: '1rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
          transition: 'all 0.2s'
        }} onMouseOver={e => {
          e.currentTarget.style.background = '#2980b9';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }} onMouseOut={e => {
          e.currentTarget.style.background = '#3498db';
          e.currentTarget.style.transform = 'translateY(0)';
        }}>
            🧮 Launch Full Interactive Gallery
          </button>
        </div>

        <div style={{
        marginTop: '40px',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
          <h4 style={{
          color: '#495057',
          marginBottom: '15px'
        }}>🚀 Implementation Details</h4>
          <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px',
          fontSize: '0.9rem',
          color: '#6c757d'
        }}>
            <div>
              <strong>Framework:</strong> React + TypeScript<br />
              <strong>Animations:</strong> React Spring<br />
              <strong>Interactions:</strong> @use-gesture/react
            </div>
            <div>
              <strong>Rendering:</strong> Pure SVG (no external libs)<br />
              <strong>State:</strong> Custom hooks<br />
              <strong>Accessibility:</strong> Colorblind-friendly palettes
            </div>
          </div>
        </div>
      </div>;
  },
  parameters: {
    docs: {
      description: {
        story: 'Overview of all gallery features and organization. This gives you a preview of what\\'s available in the full gallery.'
      }
    }
  }
}`,...(w=(C=h.parameters)==null?void 0:C.docs)==null?void 0:w.source}}};var B,T,F;x.parameters={...x.parameters,docs:{...(B=x.parameters)==null?void 0:B.docs,source:{originalSource:`{
  render: () => {
    const [selectedTab, setSelectedTab] = useState('basic');
    const tabs = {
      basic: {
        title: '📚 Basic Examples',
        description: 'Simple demonstrations of core functionality',
        examples: ['Basic Number 5', 'Colorful 123', 'Circle Beads 42', 'Large Scale 7']
      },
      advanced: {
        title: '🎨 Advanced Features',
        description: 'Complex configurations and styling options',
        examples: ['Compact 999', 'Educational 1234', 'Hidden Inactive 555', 'Mixed Geometry 321']
      },
      debug: {
        title: '🔧 Debug & Edge Cases',
        description: 'Testing scenarios and boundary conditions',
        examples: ['Single Digit', 'Four 9s (9999)', 'Large Zero', 'Debug Examples']
      }
    };
    return <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px'
    }}>
        <h2 style={{
        textAlign: 'center',
        color: '#2c3e50',
        marginBottom: '30px'
      }}>
          Gallery Tab System Demo
        </h2>

        <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
          <div style={{
          display: 'flex',
          borderBottom: '1px solid #eee'
        }}>
            {Object.entries(tabs).map(([key, tab]) => <button key={key} onClick={() => setSelectedTab(key)} style={{
            flex: 1,
            padding: '20px',
            background: selectedTab === key ? '#f8f9fa' : 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600',
            color: selectedTab === key ? '#2c3e50' : '#666',
            transition: 'all 0.3s',
            position: 'relative'
          }}>
                {tab.title}
                {selectedTab === key && <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: '#3498db'
            }} />}
              </button>)}
          </div>

          <div style={{
          padding: '30px'
        }}>
            <h3 style={{
            color: '#2c3e50',
            marginBottom: '15px'
          }}>
              {tabs[selectedTab as keyof typeof tabs].title}
            </h3>
            <p style={{
            color: '#666',
            marginBottom: '20px',
            lineHeight: 1.6
          }}>
              {tabs[selectedTab as keyof typeof tabs].description}
            </p>

            <div style={{
            background: '#f8f9fa',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
              <h4 style={{
              color: '#495057',
              marginBottom: '15px'
            }}>Examples in this section:</h4>
              <ul style={{
              color: '#6c757d',
              lineHeight: 1.8,
              paddingLeft: '20px'
            }}>
                {tabs[selectedTab as keyof typeof tabs].examples.map((example, index) => <li key={index}>{example}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#e8f4fd',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
          <p style={{
          color: '#0c5460',
          margin: 0
        }}>
            💡 <strong>Tip:</strong> In the full gallery, each tab contains interactive abacus components
            that you can click and drag to explore different values and configurations.
          </p>
        </div>
      </div>;
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of the tab system used to organize gallery examples into logical groups.'
      }
    }
  }
}`,...(F=(T=x.parameters)==null?void 0:T.docs)==null?void 0:F.source}}};var I,R,E;v.parameters={...v.parameters,docs:{...(I=v.parameters)==null?void 0:I.docs,source:{originalSource:`{
  render: () => {
    const [stats, setStats] = useState({
      totalClicks: 0,
      valueChanges: 0,
      activeInteractions: 0
    });
    const simulateInteraction = (type: 'click' | 'value' | 'active') => {
      setStats(prev => ({
        ...prev,
        totalClicks: type === 'click' ? prev.totalClicks + 1 : prev.totalClicks,
        valueChanges: type === 'value' ? prev.valueChanges + 1 : prev.valueChanges,
        activeInteractions: type === 'active' ? prev.activeInteractions + 1 : prev.activeInteractions
      }));
    };
    const resetStats = () => {
      setStats({
        totalClicks: 0,
        valueChanges: 0,
        activeInteractions: 0
      });
    };
    return <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      padding: '20px'
    }}>
        <h2 style={{
        textAlign: 'center',
        color: '#2c3e50',
        marginBottom: '30px'
      }}>
          Statistics Tracking Demo
        </h2>

        <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        textAlign: 'center',
        marginBottom: '20px'
      }}>
          <h3 style={{
          color: '#2c3e50',
          marginBottom: '20px'
        }}>Live Gallery Statistics</h3>

          <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '30px',
          marginBottom: '30px',
          flexWrap: 'wrap'
        }}>
            <div style={{
            textAlign: 'center'
          }}>
              <div style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#3498db'
            }}>
                {stats.totalClicks}
              </div>
              <div style={{
              color: '#666',
              fontSize: '0.9rem'
            }}>Total Bead Clicks</div>
            </div>
            <div style={{
            textAlign: 'center'
          }}>
              <div style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#e74c3c'
            }}>
                {stats.valueChanges}
              </div>
              <div style={{
              color: '#666',
              fontSize: '0.9rem'
            }}>Value Changes</div>
            </div>
            <div style={{
            textAlign: 'center'
          }}>
              <div style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#f39c12'
            }}>
                {stats.activeInteractions}
              </div>
              <div style={{
              color: '#666',
              fontSize: '0.9rem'
            }}>Active Sessions</div>
            </div>
          </div>

          <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
            <button onClick={() => simulateInteraction('click')} style={{
            background: '#3498db',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
              Simulate Click
            </button>
            <button onClick={() => simulateInteraction('value')} style={{
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
              Simulate Value Change
            </button>
            <button onClick={() => simulateInteraction('active')} style={{
            background: '#f39c12',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
              Simulate Interaction
            </button>
            <button onClick={resetStats} style={{
            background: '#95a5a6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
              Reset
            </button>
          </div>
        </div>

        <div style={{
        background: '#e8f4fd',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #bee5eb'
      }}>
          <h4 style={{
          color: '#0c5460',
          marginBottom: '15px'
        }}>📊 What Gets Tracked</h4>
          <ul style={{
          color: '#0c5460',
          lineHeight: 1.8,
          paddingLeft: '20px'
        }}>
            <li><strong>Bead Clicks:</strong> Every time a user clicks on any bead</li>
            <li><strong>Value Changes:</strong> When the numeric value of an abacus changes</li>
            <li><strong>Active Sessions:</strong> Ongoing interactions across all examples</li>
            <li><strong>Per-Card Stats:</strong> Individual reset counters and click counts</li>
          </ul>
        </div>
      </div>;
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of the real-time statistics tracking system that monitors user interactions across the entire gallery.'
      }
    }
  }
}`,...(E=(R=v.parameters)==null?void 0:R.docs)==null?void 0:E.source}}};const O=["FullGallery","GalleryOverview","TabFunctionality","StatisticsTracking"];export{b as FullGallery,h as GalleryOverview,v as StatisticsTracking,x as TabFunctionality,O as __namedExportsOrder,P as default};
