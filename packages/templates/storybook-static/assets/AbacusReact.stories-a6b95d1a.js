import{A as w,j as s,a as r,u as Ae}from"./AbacusReact-1f2a91b6.js";import{I as Re,v as Ee}from"./preview-errors-dde4324f.js";import{r as _}from"./index-76fb7be0.js";import"./index-d3ea75b5.js";import"./_commonjsHelpers-de833af9.js";import"./index-356e4a49.js";const{addons:Oe}=__STORYBOOK_MODULE_PREVIEW_API__,{global:I}=__STORYBOOK_MODULE_GLOBAL__;var De="storybook/actions",_e=`${De}/action-event`,Ie={depth:10,clearOnStoryChange:!0,limit:50},Be=(a,n)=>{let o=Object.getPrototypeOf(a);return!o||n(o)?o:Be(o,n)},ze=a=>!!(typeof a=="object"&&a&&Be(a,n=>/^Synthetic(?:Base)?Event$/.test(n.constructor.name))&&typeof a.persist=="function"),Te=a=>{if(ze(a)){let n=Object.create(a.constructor.prototype,Object.getOwnPropertyDescriptors(a));n.persist();let o=Object.getOwnPropertyDescriptor(n,"view"),t=o==null?void 0:o.value;return typeof t=="object"&&(t==null?void 0:t.constructor.name)==="Window"&&Object.defineProperty(n,"view",{...o,value:Object.create(t.constructor.prototype)}),n}return a},je=()=>typeof crypto=="object"&&typeof crypto.getRandomValues=="function"?Ee():Date.now().toString(36)+Math.random().toString(36).substring(2);function e(a,n={}){let o={...Ie,...n},t=function(...l){var R,E;if(n.implicit){let O=(R="__STORYBOOK_PREVIEW__"in I?I.__STORYBOOK_PREVIEW__:void 0)==null?void 0:R.storyRenders.find(i=>i.phase==="playing"||i.phase==="rendering");if(O){let i=!((E=window==null?void 0:window.FEATURES)!=null&&E.disallowImplicitActionsInRenderV8),D=new Re({phase:O.phase,name:a,deprecated:i});if(i)console.warn(D);else throw D}}let B=Oe.getChannel(),P=je(),A=5,c=l.map(Te),F=l.length>1?c:c[0],Pe={id:P,count:0,data:{name:a,args:F},options:{...o,maxDepth:A+(o.depth||3),allowFunction:o.allowFunction||!1}};B.emit(_e,Pe)};return t.isAction=!0,t}const Ke={title:"Soroban/AbacusReact",component:w,parameters:{layout:"centered",docs:{description:{component:`
# AbacusReact Component

A complete React component for rendering interactive Soroban (Japanese abacus) SVGs with animations, drag interactions, and comprehensive configuration options.

## Features

- 🎨 **Framework-free SVG rendering** - Complete control over all elements and viewBox
- 🎯 **Interactive beads** - Click to toggle or drag with @use-gesture/react
- 🌈 **Multiple color schemes** - Monochrome, place-value, alternating, heaven-earth
- 🎭 **Bead shapes** - Diamond, square, or circle beads
- ⚡ **React Spring animations** - Smooth bead movements and transitions
- 🔧 **Hooks interface** - Size calculation and state management hooks
- 📱 **Responsive scaling** - Configurable scale factor for different sizes
        `}}},tags:["autodocs"],argTypes:{value:{control:{type:"number",min:0,max:99999},description:"The numeric value to display on the abacus"},columns:{control:{type:"select"},options:["auto",1,2,3,4,5],description:"Number of columns or auto-calculate based on value"},beadShape:{control:{type:"select"},options:["diamond","square","circle"],description:"Shape of the beads"},colorScheme:{control:{type:"select"},options:["monochrome","place-value","alternating","heaven-earth"],description:"Color scheme strategy"},colorPalette:{control:{type:"select"},options:["default","colorblind","mnemonic","grayscale","nature"],description:"Color palette for place values"},scaleFactor:{control:{type:"range",min:.5,max:3,step:.1},description:"Scale multiplier for component size"},animated:{control:{type:"boolean"},description:"Enable react-spring animations"},draggable:{control:{type:"boolean"},description:"Enable drag interactions with @use-gesture/react"},hideInactiveBeads:{control:{type:"boolean"},description:"Hide inactive beads completely"},showEmptyColumns:{control:{type:"boolean"},description:"Show leading zero columns"},onClick:{action:"bead-clicked"},onValueChange:{action:"value-changed"}}},d={args:{value:5,columns:1,beadShape:"diamond",colorScheme:"monochrome",scaleFactor:1,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Basic representation of the number 5 using a single column with diamond-shaped beads."}}}},u={args:{value:123,columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:1,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Multi-column abacus showing 123 with place-value colors (ones=blue, tens=magenta, hundreds=orange)."}}}},m={args:{value:42,columns:2,beadShape:"circle",colorScheme:"place-value",colorPalette:"default",scaleFactor:1.2,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Demonstration of circular bead shapes with larger scale factor for better visibility."}}}},p={args:{value:999,columns:3,beadShape:"square",colorScheme:"alternating",scaleFactor:.8,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Compact design using square beads with alternating column colors."}}}},g={args:{value:678,columns:3,beadShape:"diamond",colorScheme:"monochrome",scaleFactor:1,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Traditional monochrome color scheme - all active beads are black."}}}},h={args:{value:1234,columns:4,beadShape:"circle",colorScheme:"place-value",colorPalette:"mnemonic",scaleFactor:.9,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Place-value coloring with mnemonic palette - each place value has a memorable color association."}}}},b={args:{value:555,columns:3,beadShape:"diamond",colorScheme:"alternating",scaleFactor:1,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Alternating column colors (blue/green) to help distinguish place values."}}}},v={args:{value:789,columns:3,beadShape:"circle",colorScheme:"heaven-earth",scaleFactor:1,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Heaven-earth color scheme - heaven beads (value 5) are red, earth beads (value 1) are blue."}}}},S={args:{value:0,columns:1,beadShape:"circle",colorScheme:"monochrome",scaleFactor:2,hideInactiveBeads:!1,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Empty abacus showing all inactive beads - demonstrates the zero state."}}}},y={args:{value:555,columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"nature",hideInactiveBeads:!0,scaleFactor:1.4,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Clean design with inactive beads hidden - only shows the active beads."}}}},C={args:{value:7,columns:1,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:2.5,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Large scale demonstration for presentations or accessibility needs."}}}},k={args:{value:12345,columns:5,beadShape:"circle",colorScheme:"place-value",colorPalette:"colorblind",scaleFactor:.8,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Colorblind-friendly palette designed for maximum accessibility and contrast."}}}},f={args:{value:1111,columns:4,beadShape:"square",colorScheme:"place-value",colorPalette:"grayscale",scaleFactor:1,animated:!0,draggable:!0,onClick:e("bead-clicked"),onValueChange:e("value-changed")},parameters:{docs:{description:{story:"Grayscale palette suitable for printing or monochrome displays."}}}},V={render:a=>{const[n,o]=_.useState(a.value||123),[t,l]=_.useState(0);return s("div",{style:{textAlign:"center"},children:[s("div",{style:{marginBottom:"20px"},children:[r("h3",{children:"Interactive Abacus Demo"}),s("p",{children:["Click beads to change values • Current Value: ",r("strong",{children:n})," • Clicks: ",r("strong",{children:t})]}),r("button",{onClick:()=>{o(a.value||123),l(0)},style:{background:"#3498db",color:"white",border:"none",borderRadius:"4px",padding:"8px 16px",cursor:"pointer",marginBottom:"10px"},children:"Reset"})]}),r(w,{...a,value:n,onClick:c=>{l(F=>F+1),e("bead-clicked")(c)},onValueChange:c=>{o(c),e("value-changed")(c)}})]})},args:{value:123,columns:3,beadShape:"diamond",colorScheme:"place-value",colorPalette:"default",scaleFactor:1.2,animated:!0,draggable:!0},parameters:{docs:{description:{story:"Fully interactive example with click counter and reset functionality. Try clicking the beads!"}}}},x={render:a=>{const n=Ae(3,a.scaleFactor||1);return s("div",{style:{textAlign:"center"},children:[s("div",{style:{marginBottom:"20px"},children:[r("h3",{children:"Sizing Information"}),s("p",{children:[r("strong",{children:"Dimensions:"})," ",n.width.toFixed(1)," × ",n.height.toFixed(1),"px",r("br",{}),r("strong",{children:"Rod Spacing:"})," ",n.rodSpacing.toFixed(1),"px",r("br",{}),r("strong",{children:"Bead Size:"})," ",n.beadSize.toFixed(1),"px"]})]}),r("div",{style:{border:"2px dashed #ccc",display:"inline-block",padding:"10px",borderRadius:"8px"},children:r(w,{...a})})]})},args:{value:567,columns:3,beadShape:"diamond",colorScheme:"place-value",scaleFactor:1,animated:!0,draggable:!0},parameters:{docs:{description:{story:"Demonstration of the useAbacusDimensions hook for layout planning. The dashed border shows the exact component dimensions."}}}};var z,T,j;d.parameters={...d.parameters,docs:{...(z=d.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    value: 5,
    columns: 1,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    scaleFactor: 1,
    animated: true,
    draggable: true,
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
}`,...(j=(T=d.parameters)==null?void 0:T.docs)==null?void 0:j.source}}};var M,q,H;u.parameters={...u.parameters,docs:{...(M=u.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    value: 123,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1,
    animated: true,
    draggable: true,
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
}`,...(H=(q=u.parameters)==null?void 0:q.docs)==null?void 0:H.source}}};var L,G,N;m.parameters={...m.parameters,docs:{...(L=m.parameters)==null?void 0:L.docs,source:{originalSource:`{
  args: {
    value: 42,
    columns: 2,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 1.2,
    animated: true,
    draggable: true,
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
}`,...(N=(G=m.parameters)==null?void 0:G.docs)==null?void 0:N.source}}};var K,W,Y;p.parameters={...p.parameters,docs:{...(K=p.parameters)==null?void 0:K.docs,source:{originalSource:`{
  args: {
    value: 999,
    columns: 3,
    beadShape: 'square',
    colorScheme: 'alternating',
    scaleFactor: 0.8,
    animated: true,
    draggable: true,
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
}`,...(Y=(W=p.parameters)==null?void 0:W.docs)==null?void 0:Y.source}}};var U,$,J;g.parameters={...g.parameters,docs:{...(U=g.parameters)==null?void 0:U.docs,source:{originalSource:`{
  args: {
    value: 678,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    scaleFactor: 1,
    animated: true,
    draggable: true,
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
}`,...(J=($=g.parameters)==null?void 0:$.docs)==null?void 0:J.source}}};var Q,X,Z;h.parameters={...h.parameters,docs:{...(Q=h.parameters)==null?void 0:Q.docs,source:{originalSource:`{
  args: {
    value: 1234,
    columns: 4,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'mnemonic',
    scaleFactor: 0.9,
    animated: true,
    draggable: true,
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
}`,...(Z=(X=h.parameters)==null?void 0:X.docs)==null?void 0:Z.source}}};var ee,ae,ne;b.parameters={...b.parameters,docs:{...(ee=b.parameters)==null?void 0:ee.docs,source:{originalSource:`{
  args: {
    value: 555,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'alternating',
    scaleFactor: 1,
    animated: true,
    draggable: true,
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
}`,...(ne=(ae=b.parameters)==null?void 0:ae.docs)==null?void 0:ne.source}}};var oe,re,te;v.parameters={...v.parameters,docs:{...(oe=v.parameters)==null?void 0:oe.docs,source:{originalSource:`{
  args: {
    value: 789,
    columns: 3,
    beadShape: 'circle',
    colorScheme: 'heaven-earth',
    scaleFactor: 1,
    animated: true,
    draggable: true,
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
}`,...(te=(re=v.parameters)==null?void 0:re.docs)==null?void 0:te.source}}};var ce,se,le;S.parameters={...S.parameters,docs:{...(ce=S.parameters)==null?void 0:ce.docs,source:{originalSource:`{
  args: {
    value: 0,
    columns: 1,
    beadShape: 'circle',
    colorScheme: 'monochrome',
    scaleFactor: 2,
    hideInactiveBeads: false,
    animated: true,
    draggable: true,
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
}`,...(le=(se=S.parameters)==null?void 0:se.docs)==null?void 0:le.source}}};var ie,de,ue;y.parameters={...y.parameters,docs:{...(ie=y.parameters)==null?void 0:ie.docs,source:{originalSource:`{
  args: {
    value: 555,
    columns: 3,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'nature',
    hideInactiveBeads: true,
    scaleFactor: 1.4,
    animated: true,
    draggable: true,
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
}`,...(ue=(de=y.parameters)==null?void 0:de.docs)==null?void 0:ue.source}}};var me,pe,ge;C.parameters={...C.parameters,docs:{...(me=C.parameters)==null?void 0:me.docs,source:{originalSource:`{
  args: {
    value: 7,
    columns: 1,
    beadShape: 'diamond',
    colorScheme: 'place-value',
    colorPalette: 'default',
    scaleFactor: 2.5,
    animated: true,
    draggable: true,
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
}`,...(ge=(pe=C.parameters)==null?void 0:pe.docs)==null?void 0:ge.source}}};var he,be,ve;k.parameters={...k.parameters,docs:{...(he=k.parameters)==null?void 0:he.docs,source:{originalSource:`{
  args: {
    value: 12345,
    columns: 5,
    beadShape: 'circle',
    colorScheme: 'place-value',
    colorPalette: 'colorblind',
    scaleFactor: 0.8,
    animated: true,
    draggable: true,
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
}`,...(ve=(be=k.parameters)==null?void 0:be.docs)==null?void 0:ve.source}}};var Se,ye,Ce;f.parameters={...f.parameters,docs:{...(Se=f.parameters)==null?void 0:Se.docs,source:{originalSource:`{
  args: {
    value: 1111,
    columns: 4,
    beadShape: 'square',
    colorScheme: 'place-value',
    colorPalette: 'grayscale',
    scaleFactor: 1,
    animated: true,
    draggable: true,
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
}`,...(Ce=(ye=f.parameters)==null?void 0:ye.docs)==null?void 0:Ce.source}}};var ke,fe,Ve;V.parameters={...V.parameters,docs:{...(ke=V.parameters)==null?void 0:ke.docs,source:{originalSource:`{
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
    draggable: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive example with click counter and reset functionality. Try clicking the beads!'
      }
    }
  }
}`,...(Ve=(fe=V.parameters)==null?void 0:fe.docs)==null?void 0:Ve.source}}};var xe,Fe,we;x.parameters={...x.parameters,docs:{...(xe=x.parameters)==null?void 0:xe.docs,source:{originalSource:`{
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
    draggable: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstration of the useAbacusDimensions hook for layout planning. The dashed border shows the exact component dimensions.'
      }
    }
  }
}`,...(we=(Fe=x.parameters)==null?void 0:Fe.docs)==null?void 0:we.source}}};const We=["BasicNumber","MultiColumn","CircleBeads","SquareBeads","MonochromeScheme","PlaceValueScheme","AlternatingScheme","HeavenEarthScheme","EmptyAbacus","HiddenInactiveBeads","LargeScale","ColorblindPalette","GrayscalePalette","InteractiveExample","SizingDemo"];export{b as AlternatingScheme,d as BasicNumber,m as CircleBeads,k as ColorblindPalette,S as EmptyAbacus,f as GrayscalePalette,v as HeavenEarthScheme,y as HiddenInactiveBeads,V as InteractiveExample,C as LargeScale,g as MonochromeScheme,u as MultiColumn,h as PlaceValueScheme,x as SizingDemo,p as SquareBeads,We as __namedExportsOrder,Ke as default};
