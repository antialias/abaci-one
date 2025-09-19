import{A as u,j as r,a as n,u as Ge}from"./AbacusReact-7d06de32.js";import{I as Ne,v as qe}from"./preview-errors-dde4324f.js";import{r as D}from"./index-76fb7be0.js";import"./index-d3ea75b5.js";import"./_commonjsHelpers-de833af9.js";import"./index-356e4a49.js";const{addons:Le}=__STORYBOOK_MODULE_PREVIEW_API__,{global:z}=__STORYBOOK_MODULE_GLOBAL__;var We="storybook/actions",Ke=`${We}/action-event`,Ye={depth:10,clearOnStoryChange:!0,limit:50},Me=(a,t)=>{let o=Object.getPrototypeOf(a);return!o||t(o)?o:Me(o,t)},Je=a=>!!(typeof a=="object"&&a&&Me(a,t=>/^Synthetic(?:Base)?Event$/.test(t.constructor.name))&&typeof a.persist=="function"),Ue=a=>{if(Je(a)){let t=Object.create(a.constructor.prototype,Object.getOwnPropertyDescriptors(a));t.persist();let o=Object.getOwnPropertyDescriptor(t,"view"),s=o==null?void 0:o.value;return typeof s=="object"&&(s==null?void 0:s.constructor.name)==="Window"&&Object.defineProperty(t,"view",{...o,value:Object.create(s.constructor.prototype)}),t}return a},$e=()=>typeof crypto=="object"&&typeof crypto.getRandomValues=="function"?qe():Date.now().toString(36)+Math.random().toString(36).substring(2);function e(a,t={}){let o={...Ye,...t},s=function(...c){var T,H;if(t.implicit){let O=(T="__STORYBOOK_PREVIEW__"in z?z.__STORYBOOK_PREVIEW__:void 0)==null?void 0:T.storyRenders.find(m=>m.phase==="playing"||m.phase==="rendering");if(O){let m=!((H=window==null?void 0:window.FEATURES)!=null&&H.disallowImplicitActionsInRenderV8),_=new Ne({phase:O.phase,name:a,deprecated:m});if(m)console.warn(_);else throw _}}let i=Le.getChannel(),l=$e(),R=5,d=c.map(Ue),E=c.length>1?d:d[0],je={id:l,count:0,data:{name:a,args:E},options:{...o,maxDepth:R+(o.depth||3),allowFunction:o.allowFunction||!1}};i.emit(Ke,je)};return s.isAction=!0,s}const ta={title:"Soroban/AbacusReact",component:u,parameters:{layout:"centered",docs:{description:{component:`
# AbacusReact Component

A complete React component for rendering interactive Soroban (Japanese abacus) SVGs with animations and directional gesture interactions.

## Features

- 🎨 **Framework-free SVG rendering** - Complete control over all elements and viewBox
- 🎯 **Interactive beads** - Click to toggle or use directional gestures
- 🔄 **Directional gestures** - Drag beads in natural directions to activate/deactivate
- 🌈 **Multiple color schemes** - Monochrome, place-value, alternating, heaven-earth
- 🎭 **Bead shapes** - Diamond, square, or circle beads
- ⚡ **React Spring animations** - Smooth bead movements and transitions
- 🔧 **Hooks interface** - Size calculation and state management hooks
- 📱 **Responsive scaling** - Configurable scale factor for different sizes
        `}}},tags:["autodocs"],argTypes:{value:{control:{type:"number",min:0,max:99999},description:"The numeric value to display on the abacus"},columns:{control:{type:"select"},options:["auto",1,2,3,4,5],description:"Number of columns or auto-calculate based on value"},beadShape:{control:{type:"select"},options:["diamond","square","circle"],description:"Shape of the beads"},colorScheme:{control:{type:"select"},options:["monochrome","place-value","alternating","heaven-earth"],description:"Color scheme strategy"},colorPalette:{control:{type:"select"},options:["default","colorblind","mnemonic","grayscale","nature"],description:"Color palette for place values"},scaleFactor:{control:{type:"range",min:.5,max:3,step:.1},description:"Scale multiplier for component size"},animated:{control:{type:"boolean"},description:"Enable react-spring animations"},gestures:{control:{type:"boolean"},description:"Enable directional gesture interactions"},hideInactiveBeads:{control:{type:"boolean"},description:"Hide inactive beads completely"},showEmptyColumns:{control:{type:"boolean"},description:"Show leading zero columns"},onClick:{action:"bead-clicked"},onValueChange:{action:"value-changed"}}},p={args:{value:5,columns:1,beadShape:"diamond",colorScheme:"monochrome",scaleFactor:1,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Basic representation of the number 5 using a single column with diamond-shaped beads."}}}},h={args:{value:123,columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:1,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Multi-column abacus showing 123 with place-value colors (ones=blue, tens=magenta, hundreds=orange)."}}}},g={args:{value:42,columns:2,beadShape:"circle",colorScheme:"place-value",colorPalette:"default",scaleFactor:1.2,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Demonstration of circular bead shapes with larger scale factor for better visibility."}}}},v={args:{value:999,columns:3,beadShape:"square",colorScheme:"alternating",scaleFactor:.8,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Compact design using square beads with alternating column colors."}}}},b={args:{value:678,columns:3,beadShape:"diamond",colorScheme:"monochrome",scaleFactor:1,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Traditional monochrome color scheme - all active beads are black."}}}},y={args:{value:1234,columns:4,beadShape:"circle",colorScheme:"place-value",colorPalette:"mnemonic",scaleFactor:.9,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Place-value coloring with mnemonic palette - each place value has a memorable color association."}}}},S={args:{value:555,columns:3,beadShape:"diamond",colorScheme:"alternating",scaleFactor:1,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Alternating column colors (blue/green) to help distinguish place values."}}}},C={args:{value:789,columns:3,beadShape:"circle",colorScheme:"heaven-earth",scaleFactor:1,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Heaven-earth color scheme - heaven beads (value 5) are red, earth beads (value 1) are blue."}}}},k={args:{value:0,columns:1,beadShape:"circle",colorScheme:"monochrome",scaleFactor:2,hideInactiveBeads:!1,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Empty abacus showing all inactive beads - demonstrates the zero state."}}}},f={args:{value:555,columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"nature",hideInactiveBeads:!0,scaleFactor:1.4,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Clean design with inactive beads hidden - only shows the active beads."}}}},V={args:{value:7,columns:1,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:2.5,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Large scale demonstration for presentations or accessibility needs."}}}},x={args:{value:12345,columns:5,beadShape:"circle",colorScheme:"place-value",colorPalette:"colorblind",scaleFactor:.8,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Colorblind-friendly palette designed for maximum accessibility and contrast."}}}},w={args:{value:1111,columns:4,beadShape:"square",colorScheme:"place-value",colorPalette:"grayscale",scaleFactor:1,animated:!0,gestures:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Grayscale palette suitable for printing or monochrome displays."}}}},B={render:a=>{const[t,o]=D.useState(a.value||123),[s,c]=D.useState(0);return r("div",{style:{textAlign:"center"},children:[r("div",{style:{marginBottom:"20px"},children:[n("h3",{children:"Interactive Abacus Demo"}),r("p",{children:["Click beads to change values • Current Value: ",n("strong",{children:t})," • Clicks: ",n("strong",{children:s})]}),n("button",{onClick:()=>{o(a.value||123),c(0)},style:{background:"#3498db",color:"white",border:"none",borderRadius:"4px",padding:"8px 16px",cursor:"pointer",marginBottom:"10px"},children:"Reset"})]}),n(u,{...a,value:t,onClick:d=>{c(E=>E+1),e("bead-clicked")(d)},onValueChange:d=>{o(d),e("value-changed")(d)}})]})},args:{value:123,columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:1.2,animated:!0,gestures:!0},parameters:{docs:{description:{story:"Fully interactive example with click counter and reset functionality. Click the beads to toggle their states!"}}}},I={args:{value:123,columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:1.5,animated:!0,gestures:!0},parameters:{docs:{description:{story:`
**Directional Gesture Testing**

Test the new directional gesture system:
- **Heaven beads**: Drag down toward the bar to activate, drag up away from bar to deactivate
- **Earth beads**: Drag up toward the bar to activate, drag down away from bar to deactivate
- **Direction reversals**: Change drag direction mid-gesture and watch the bead follow
- **Independent behavior**: Each bead responds only to its own gesture, beads don't push each other

The gesture system tracks cursor movement direction and toggles beads based on natural abacus movements.
        `}}}},F={render:a=>{const t=Ge(3,a.scaleFactor||1);return r("div",{style:{textAlign:"center"},children:[r("div",{style:{marginBottom:"20px"},children:[n("h3",{children:"Sizing Information"}),r("p",{children:[n("strong",{children:"Dimensions:"})," ",t.width.toFixed(1)," × ",t.height.toFixed(1),"px",n("br",{}),n("strong",{children:"Rod Spacing:"})," ",t.rodSpacing.toFixed(1),"px",n("br",{}),n("strong",{children:"Bead Size:"})," ",t.beadSize.toFixed(1),"px"]})]}),n("div",{style:{border:"2px dashed #ccc",display:"inline-block",padding:"10px",borderRadius:"8px"},children:n(u,{...a})})]})},args:{value:567,columns:3,beadShape:"diamond",colorScheme:"place-value",scaleFactor:1,animated:!0,gestures:!0},parameters:{docs:{description:{story:"Demonstration of the useAbacusDimensions hook for layout planning. The dashed border shows the exact component dimensions."}}}},A={render:a=>{const[t,o]=D.useState(a.value||555),s=l=>{e("bead-clicked")(l)},c=l=>{o(l),e("value-changed")(l)};return r("div",{style:{textAlign:"center"},children:[r("div",{style:{marginBottom:"20px"},children:[n("h3",{children:"CSS-Based Hidden Inactive Beads"}),r("p",{children:[n("strong",{children:"Instructions:"})," Click beads to make them inactive, then hover over the abacus to see smooth opacity transitions!"]}),r("p",{children:["Current Value: ",n("strong",{children:t})]}),n("button",{onClick:()=>{o(a.value||555)},style:{background:"#3498db",color:"white",border:"none",borderRadius:"4px",padding:"8px 16px",cursor:"pointer",marginBottom:"10px"},children:"Reset to 555"})]}),r("div",{style:{display:"flex",justifyContent:"center",gap:"40px",alignItems:"flex-start"},children:[r("div",{children:[n("h4",{children:"Normal Mode"}),n(u,{...a,value:t,hideInactiveBeads:!1,onClick:s,onValueChange:c})]}),r("div",{children:[n("h4",{children:"CSS Hidden Inactive Mode"}),r("p",{style:{fontSize:"12px",color:"#666",marginBottom:"10px"},children:["• Inactive beads: opacity 0",n("br",{}),"• Hover abacus: opacity 0.5",n("br",{}),"• Hover bead: opacity 1"]}),n(u,{...a,value:t,hideInactiveBeads:!0,onClick:s,onValueChange:c})]})]})]})},args:{value:555,columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:1.2,animated:!0,gestures:!0},parameters:{docs:{description:{story:`
**CSS-Based Hidden Inactive Beads System**

This implementation uses pure CSS for smooth opacity transitions:

1. **Default State**: Inactive beads have \`opacity: 0\` (completely hidden)
2. **Abacus Hover**: All inactive beads get \`opacity: 0.5\` (semi-transparent)
3. **Individual Bead Hover**: Specific inactive bead gets \`opacity: 1\` (fully visible)
4. **Smooth Transitions**: All opacity changes use \`transition: opacity 0.2s ease-in-out\`

**Features**:
- ✅ Clean CSS-only implementation
- ✅ Smooth opacity transitions (0.2s ease-in-out)
- ✅ No JavaScript hover state management
- ✅ No cursor flickering issues
- ✅ Inactive beads remain clickable when visible
- ✅ Works with all existing gesture and click functionality

**Testing**: Click beads to make them inactive, then hover over the abacus to see the smooth opacity transitions in action!
        `}}}},P={render:a=>{const[t,o]=D.useState(a.value||123);return r("div",{style:{textAlign:"center"},children:[r("div",{style:{marginBottom:"20px"},children:[n("h3",{children:"Interactive Place Value Editing"}),r("p",{children:[n("strong",{children:"Instructions:"})," Click on the number displays below each column to edit them directly!"]}),r("p",{children:["Current Value: ",n("strong",{children:t})]})]}),n(u,{...a,value:t,onClick:i=>{e("bead-clicked")(i)},onValueChange:i=>{o(i),e("value-changed")(i)}}),n("div",{style:{marginTop:"20px",fontSize:"14px",color:"#666"},children:r("p",{children:[n("strong",{children:"How to use:"})," Click numbers below columns → Type 0-9 → Press Enter/Esc"]})})]})},args:{value:123,columns:3,beadShape:"diamond",colorScheme:"place-value",scaleFactor:1.2,animated:!0,gestures:!0},parameters:{docs:{description:{story:"SVG-based interactive place value editing with perfect alignment to abacus columns."}}}};var M,j,G;p.parameters={...p.parameters,docs:{...(M=p.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    value: 5,
    columns: 1,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    scaleFactor: 1,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Basic representation of the number 5 using a single column with diamond-shaped beads.'
      }
    }
  }
}`,...(G=(j=p.parameters)==null?void 0:j.docs)==null?void 0:G.source}}};var N,q,L;h.parameters={...h.parameters,docs:{...(N=h.parameters)==null?void 0:N.docs,source:{originalSource:`{
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Multi-column abacus showing 123 with place-value colors (ones=blue, tens=magenta, hundreds=orange).'
      }
    }
  }
}`,...(L=(q=h.parameters)==null?void 0:q.docs)==null?void 0:L.source}}};var W,K,Y;g.parameters={...g.parameters,docs:{...(W=g.parameters)==null?void 0:W.docs,source:{originalSource:`{
  args: {
    value: 42,
    columns: 2,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.2,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of circular bead shapes with larger scale factor for better visibility.'
      }
    }
  }
}`,...(Y=(K=g.parameters)==null?void 0:K.docs)==null?void 0:Y.source}}};var J,U,$;v.parameters={...v.parameters,docs:{...(J=v.parameters)==null?void 0:J.docs,source:{originalSource:`{
  args: {
    value: 999,
    columns: 3,
    beadShape: 'square',
    colorScheme: 'alternating',
    scaleFactor: 0.8,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact design using square beads with alternating column colors.'
      }
    }
  }
}`,...($=(U=v.parameters)==null?void 0:U.docs)==null?void 0:$.source}}};var Q,X,Z;b.parameters={...b.parameters,docs:{...(Q=b.parameters)==null?void 0:Q.docs,source:{originalSource:`{
  args: {
    value: 678,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    scaleFactor: 1,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Traditional monochrome color scheme - all active beads are black.'
      }
    }
  }
}`,...(Z=(X=b.parameters)==null?void 0:X.docs)==null?void 0:Z.source}}};var ee,ae,ne;y.parameters={...y.parameters,docs:{...(ee=y.parameters)==null?void 0:ee.docs,source:{originalSource:`{
  args: {
    value: 1234,
    columns: 4,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'mnemonic',
    scaleFactor: 0.9,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Place-value coloring with mnemonic palette - each place value has a memorable color association.'
      }
    }
  }
}`,...(ne=(ae=y.parameters)==null?void 0:ae.docs)==null?void 0:ne.source}}};var te,oe,re;S.parameters={...S.parameters,docs:{...(te=S.parameters)==null?void 0:te.docs,source:{originalSource:`{
  args: {
    value: 555,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'alternating',
    scaleFactor: 1,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Alternating column colors (blue/green) to help distinguish place values.'
      }
    }
  }
}`,...(re=(oe=S.parameters)==null?void 0:oe.docs)==null?void 0:re.source}}};var se,ce,ie;C.parameters={...C.parameters,docs:{...(se=C.parameters)==null?void 0:se.docs,source:{originalSource:`{
  args: {
    value: 789,
    columns: 3,
    beadShape: 'circle',
    colorScheme: 'heaven-earth',
    scaleFactor: 1,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Heaven-earth color scheme - heaven beads (value 5) are red, earth beads (value 1) are blue.'
      }
    }
  }
}`,...(ie=(ce=C.parameters)==null?void 0:ce.docs)==null?void 0:ie.source}}};var le,de,ue;k.parameters={...k.parameters,docs:{...(le=k.parameters)==null?void 0:le.docs,source:{originalSource:`{
  args: {
    value: 0,
    columns: 1,
    beadShape: 'circle',
    colorScheme: 'monochrome',
    scaleFactor: 2,
    hideInactiveBeads: false,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty abacus showing all inactive beads - demonstrates the zero state.'
      }
    }
  }
}`,...(ue=(de=k.parameters)==null?void 0:de.docs)==null?void 0:ue.source}}};var me,pe,he;f.parameters={...f.parameters,docs:{...(me=f.parameters)==null?void 0:me.docs,source:{originalSource:`{
  args: {
    value: 555,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'nature',
    hideInactiveBeads: true,
    scaleFactor: 1.4,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Clean design with inactive beads hidden - only shows the active beads.'
      }
    }
  }
}`,...(he=(pe=f.parameters)==null?void 0:pe.docs)==null?void 0:he.source}}};var ge,ve,be;V.parameters={...V.parameters,docs:{...(ge=V.parameters)==null?void 0:ge.docs,source:{originalSource:`{
  args: {
    value: 7,
    columns: 1,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 2.5,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Large scale demonstration for presentations or accessibility needs.'
      }
    }
  }
}`,...(be=(ve=V.parameters)==null?void 0:ve.docs)==null?void 0:be.source}}};var ye,Se,Ce;x.parameters={...x.parameters,docs:{...(ye=x.parameters)==null?void 0:ye.docs,source:{originalSource:`{
  args: {
    value: 12345,
    columns: 5,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'colorblind',
    scaleFactor: 0.8,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Colorblind-friendly palette designed for maximum accessibility and contrast.'
      }
    }
  }
}`,...(Ce=(Se=x.parameters)==null?void 0:Se.docs)==null?void 0:Ce.source}}};var ke,fe,Ve;w.parameters={...w.parameters,docs:{...(ke=w.parameters)==null?void 0:ke.docs,source:{originalSource:`{
  args: {
    value: 1111,
    columns: 4,
    beadShape: 'square',
    colorScheme: 'place-value',
    colorPalette: 'grayscale',
    scaleFactor: 1,
    animated: true,
    gestures: true,
    onClick: action('bead-clicked'),
    onValueChange: action('value-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Grayscale palette suitable for printing or monochrome displays.'
      }
    }
  }
}`,...(Ve=(fe=w.parameters)==null?void 0:fe.docs)==null?void 0:Ve.source}}};var xe,we,Be;B.parameters={...B.parameters,docs:{...(xe=B.parameters)==null?void 0:xe.docs,source:{originalSource:`{
  render: args => {
    const [value, setValue] = useState(args.value || 123);
    const [clickCount, setClickCount] = useState(0);
    const handleBeadClick = (bead: any) => {
      setClickCount(prev => prev + 1);
      action('bead-clicked')(bead);
    };
    const handleValueChange = (newValue: number) => {
      setValue(newValue);
      action('value-changed')(newValue);
    };
    const resetValue = () => {
      setValue(args.value || 123);
      setClickCount(0);
    };
    return <div style={{
      textAlign: 'center'
    }}>
        <div style={{
        marginBottom: '20px'
      }}>
          <h3>Interactive Abacus Demo</h3>
          <p>Click beads to change values • Current Value: <strong>{value}</strong> • Clicks: <strong>{clickCount}</strong></p>
          <button onClick={resetValue} style={{
          background: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 16px',
          cursor: 'pointer',
          marginBottom: '10px'
        }}>
            Reset
          </button>
        </div>
        <AbacusReact {...args} value={value} onClick={handleBeadClick} onValueChange={handleValueChange} />
      </div>;
  },
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.2,
    animated: true,
    gestures: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive example with click counter and reset functionality. Click the beads to toggle their states!'
      }
    }
  }
}`,...(Be=(we=B.parameters)==null?void 0:we.docs)==null?void 0:Be.source}}};var Ie,Fe,Ae;I.parameters={...I.parameters,docs:{...(Ie=I.parameters)==null?void 0:Ie.docs,source:{originalSource:`{
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.5,
    animated: true,
    gestures: true
  },
  parameters: {
    docs: {
      description: {
        story: \`
**Directional Gesture Testing**

Test the new directional gesture system:
- **Heaven beads**: Drag down toward the bar to activate, drag up away from bar to deactivate
- **Earth beads**: Drag up toward the bar to activate, drag down away from bar to deactivate
- **Direction reversals**: Change drag direction mid-gesture and watch the bead follow
- **Independent behavior**: Each bead responds only to its own gesture, beads don't push each other

The gesture system tracks cursor movement direction and toggles beads based on natural abacus movements.
        \`
      }
    }
  }
}`,...(Ae=(Fe=I.parameters)==null?void 0:Fe.docs)==null?void 0:Ae.source}}};var Pe,De,Ee;F.parameters={...F.parameters,docs:{...(Pe=F.parameters)==null?void 0:Pe.docs,source:{originalSource:`{
  render: args => {
    const dimensions = useAbacusDimensions(3, args.scaleFactor || 1);
    return <div style={{
      textAlign: 'center'
    }}>
        <div style={{
        marginBottom: '20px'
      }}>
          <h3>Sizing Information</h3>
          <p>
            <strong>Dimensions:</strong> {dimensions.width.toFixed(1)} × {dimensions.height.toFixed(1)}px<br />
            <strong>Rod Spacing:</strong> {dimensions.rodSpacing.toFixed(1)}px<br />
            <strong>Bead Size:</strong> {dimensions.beadSize.toFixed(1)}px
          </p>
        </div>
        <div style={{
        border: '2px dashed #ccc',
        display: 'inline-block',
        padding: '10px',
        borderRadius: '8px'
      }}>
          <AbacusReact {...args} />
        </div>
      </div>;
  },
  args: {
    value: 567,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    scaleFactor: 1,
    animated: true,
    gestures: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of the useAbacusDimensions hook for layout planning. The dashed border shows the exact component dimensions.'
      }
    }
  }
}`,...(Ee=(De=F.parameters)==null?void 0:De.docs)==null?void 0:Ee.source}}};var Re,Te,He;A.parameters={...A.parameters,docs:{...(Re=A.parameters)==null?void 0:Re.docs,source:{originalSource:`{
  render: args => {
    const [value, setValue] = useState(args.value || 555);
    const handleBeadClick = (bead: any) => {
      action('bead-clicked')(bead);
    };
    const handleValueChange = (newValue: number) => {
      setValue(newValue);
      action('value-changed')(newValue);
    };
    const resetValue = () => {
      setValue(args.value || 555);
    };
    return <div style={{
      textAlign: 'center'
    }}>
        <div style={{
        marginBottom: '20px'
      }}>
          <h3>CSS-Based Hidden Inactive Beads</h3>
          <p><strong>Instructions:</strong> Click beads to make them inactive, then hover over the abacus to see smooth opacity transitions!</p>
          <p>Current Value: <strong>{value}</strong></p>
          <button onClick={resetValue} style={{
          background: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 16px',
          cursor: 'pointer',
          marginBottom: '10px'
        }}>
            Reset to 555
          </button>
        </div>

        <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '40px',
        alignItems: 'flex-start'
      }}>
          <div>
            <h4>Normal Mode</h4>
            <AbacusReact {...args} value={value} hideInactiveBeads={false} onClick={handleBeadClick} onValueChange={handleValueChange} />
          </div>

          <div>
            <h4>CSS Hidden Inactive Mode</h4>
            <p style={{
            fontSize: '12px',
            color: '#666',
            marginBottom: '10px'
          }}>
              • Inactive beads: opacity 0<br />
              • Hover abacus: opacity 0.5<br />
              • Hover bead: opacity 1
            </p>
            <AbacusReact {...args} value={value} hideInactiveBeads={true} onClick={handleBeadClick} onValueChange={handleValueChange} />
          </div>
        </div>
      </div>;
  },
  args: {
    value: 555,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.2,
    animated: true,
    gestures: true
  },
  parameters: {
    docs: {
      description: {
        story: \`
**CSS-Based Hidden Inactive Beads System**

This implementation uses pure CSS for smooth opacity transitions:

1. **Default State**: Inactive beads have \\\`opacity: 0\\\` (completely hidden)
2. **Abacus Hover**: All inactive beads get \\\`opacity: 0.5\\\` (semi-transparent)
3. **Individual Bead Hover**: Specific inactive bead gets \\\`opacity: 1\\\` (fully visible)
4. **Smooth Transitions**: All opacity changes use \\\`transition: opacity 0.2s ease-in-out\\\`

**Features**:
- ✅ Clean CSS-only implementation
- ✅ Smooth opacity transitions (0.2s ease-in-out)
- ✅ No JavaScript hover state management
- ✅ No cursor flickering issues
- ✅ Inactive beads remain clickable when visible
- ✅ Works with all existing gesture and click functionality

**Testing**: Click beads to make them inactive, then hover over the abacus to see the smooth opacity transitions in action!
        \`
      }
    }
  }
}`,...(He=(Te=A.parameters)==null?void 0:Te.docs)==null?void 0:He.source}}};var Oe,_e,ze;P.parameters={...P.parameters,docs:{...(Oe=P.parameters)==null?void 0:Oe.docs,source:{originalSource:`{
  render: args => {
    const [value, setValue] = useState(args.value || 123);
    const handleBeadClick = (bead: any) => {
      action('bead-clicked')(bead);
    };
    const handleValueChange = (newValue: number) => {
      setValue(newValue);
      action('value-changed')(newValue);
    };
    return <div style={{
      textAlign: 'center'
    }}>
        <div style={{
        marginBottom: '20px'
      }}>
          <h3>Interactive Place Value Editing</h3>
          <p><strong>Instructions:</strong> Click on the number displays below each column to edit them directly!</p>
          <p>Current Value: <strong>{value}</strong></p>
        </div>

        <AbacusReact {...args} value={value} onClick={handleBeadClick} onValueChange={handleValueChange} />

        <div style={{
        marginTop: '20px',
        fontSize: '14px',
        color: '#666'
      }}>
          <p><strong>How to use:</strong> Click numbers below columns → Type 0-9 → Press Enter/Esc</p>
        </div>
      </div>;
  },
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    scaleFactor: 1.2,
    animated: true,
    gestures: true
  },
  parameters: {
    docs: {
      description: {
        story: 'SVG-based interactive place value editing with perfect alignment to abacus columns.'
      }
    }
  }
}`,...(ze=(_e=P.parameters)==null?void 0:_e.docs)==null?void 0:ze.source}}};const oa=["BasicNumber","MultiColumn","CircleBeads","SquareBeads","MonochromeScheme","PlaceValueScheme","AlternatingScheme","HeavenEarthScheme","EmptyAbacus","HiddenInactiveBeads","LargeScale","ColorblindPalette","GrayscalePalette","InteractiveExample","DirectionalGestures","SizingDemo","CSSHiddenInactiveBeads","InteractivePlaceValueEditing"];export{S as AlternatingScheme,p as BasicNumber,A as CSSHiddenInactiveBeads,g as CircleBeads,x as ColorblindPalette,I as DirectionalGestures,k as EmptyAbacus,w as GrayscalePalette,C as HeavenEarthScheme,f as HiddenInactiveBeads,B as InteractiveExample,P as InteractivePlaceValueEditing,V as LargeScale,b as MonochromeScheme,h as MultiColumn,y as PlaceValueScheme,F as SizingDemo,v as SquareBeads,oa as __namedExportsOrder,ta as default};
