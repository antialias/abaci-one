'use client'

import { useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { css } from '../../../styled-system/css'
import { stack, hstack } from '../../../styled-system/patterns'
import { useTheme } from '@/contexts/ThemeContext'
import { PageWithNav } from '@/components/PageWithNav'

export default function LayoutMockupPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [activeTab, setActiveTab] = useState('content')

  const tabs = [
    { id: 'content', label: 'Content', icon: '✏️' },
    { id: 'layout', label: 'Layout', icon: '📐' },
    { id: 'scaffolding', label: 'Scaffolding', icon: '🎨' },
    { id: 'difficulty', label: 'Difficulty', icon: '📊' },
  ]

  return (
    <PageWithNav navTitle="Layout Mockup" navEmoji="🎨">
      <div
        className={css({
          minHeight: '100vh',
          bg: isDark ? 'gray.900' : 'gray.50',
          pt: '20',
          px: '4',
          pb: '4',
        })}
      >
        {/* Header */}
        <div className={stack({ gap: '4', mb: '6' })}>
          <h1
            className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              textAlign: 'center',
            })}
          >
            Worksheet Generator Layout Mockup
          </h1>
          <p
            className={css({
              fontSize: 'sm',
              color: isDark ? 'gray.400' : 'gray.600',
              textAlign: 'center',
            })}
          >
            Drag the resize handles (┃) to adjust panel widths • Try collapsing panels
          </p>
        </div>

        {/* Resizable Panel Layout */}
        <PanelGroup
          direction="horizontal"
          autoSaveId="worksheet-mockup-layout"
          className={css({ height: 'calc(100vh - 280px)' })}
        >
          {/* Left Panel: Config Sidebar */}
          <Panel defaultSize={22} minSize={15} maxSize={35} collapsible>
            <div
              className={css({
                h: 'full',
                bg: isDark ? 'gray.800' : 'white',
                rounded: 'xl',
                shadow: 'card',
                p: '4',
                overflow: 'auto',
              })}
            >
              <div className={stack({ gap: '4' })}>
                {/* Header */}
                <div
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pb: '3',
                    borderBottom: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                  })}
                >
                  <h2
                    className={css({
                      fontSize: 'lg',
                      fontWeight: 'bold',
                      color: isDark ? 'gray.100' : 'gray.900',
                    })}
                  >
                    Configuration
                  </h2>
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: isDark ? 'green.400' : 'green.600',
                    })}
                  >
                    ✓ Saved
                  </div>
                </div>

                {/* Tab Navigation */}
                <div
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '2',
                  })}
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={css({
                        px: '3',
                        py: '2',
                        rounded: 'lg',
                        fontSize: 'sm',
                        fontWeight: 'medium',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        bg:
                          activeTab === tab.id
                            ? isDark
                              ? 'brand.900'
                              : 'brand.50'
                            : isDark
                              ? 'gray.700'
                              : 'gray.100',
                        color:
                          activeTab === tab.id
                            ? isDark
                              ? 'brand.200'
                              : 'brand.700'
                            : isDark
                              ? 'gray.300'
                              : 'gray.600',
                        border: '2px solid',
                        borderColor: activeTab === tab.id ? 'brand.500' : 'transparent',
                        _hover: {
                          borderColor: 'brand.400',
                        },
                      })}
                    >
                      <div className={hstack({ gap: '1.5', justify: 'center' })}>
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div
                  className={css({
                    bg: isDark ? 'gray.750' : 'gray.50',
                    rounded: 'lg',
                    p: '4',
                    minH: '400px',
                  })}
                >
                  <div className={stack({ gap: '3' })}>
                    <div
                      className={css({
                        fontSize: 'sm',
                        fontWeight: 'semibold',
                        color: isDark ? 'gray.300' : 'gray.700',
                      })}
                    >
                      {tabs.find((t) => t.id === activeTab)?.label} Tab Content
                    </div>
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: isDark ? 'gray.400' : 'gray.500',
                        lineHeight: '1.6',
                      })}
                    >
                      {activeTab === 'content' && (
                        <>
                          • Student Name
                          <br />• Operator (Addition/Subtraction/Mixed)
                          <br />• Difficulty Method (Smart/Mastery)
                          <br />• Progressive Difficulty Toggle
                        </>
                      )}
                      {activeTab === 'layout' && (
                        <>
                          • Orientation (Portrait/Landscape)
                          <br />• Problems per Page
                          <br />• Pages (1-4)
                          <br />• Layout Options (Numbers, Borders)
                        </>
                      )}
                      {activeTab === 'scaffolding' && (
                        <>
                          • Answer Boxes
                          <br />• Place Value Colors
                          <br />• Carry/Borrow Boxes
                          <br />• Borrowed 10s Box
                          <br />• Borrowing Hints
                          <br />• Ten-Frames
                        </>
                      )}
                      {activeTab === 'difficulty' && (
                        <>
                          • Difficulty Preset Dropdown
                          <br />• Make Easier/Harder Buttons
                          <br />• Overall Difficulty Slider
                          <br />• Digit Range
                          <br />• Regrouping Frequency
                        </>
                      )}
                    </div>

                    {/* Sample Controls */}
                    <div className={stack({ gap: '2', mt: '2' })}>
                      <div
                        className={css({
                          px: '3',
                          py: '2',
                          bg: isDark ? 'gray.700' : 'white',
                          rounded: 'md',
                          fontSize: 'xs',
                          color: isDark ? 'gray.300' : 'gray.700',
                        })}
                      >
                        Sample Control 1
                      </div>
                      <div
                        className={css({
                          px: '3',
                          py: '2',
                          bg: isDark ? 'gray.700' : 'white',
                          rounded: 'md',
                          fontSize: 'xs',
                          color: isDark ? 'gray.300' : 'gray.700',
                        })}
                      >
                        Sample Control 2
                      </div>
                    </div>
                  </div>
                </div>

                {/* Settings Indicator */}
                <div
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'gray.400' : 'gray.500',
                    textAlign: 'center',
                    pt: '2',
                    borderTop: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                  })}
                >
                  Settings auto-save as you change them
                </div>
              </div>
            </div>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle
            className={css({
              width: '8px',
              bg: isDark ? 'gray.700' : 'gray.200',
              position: 'relative',
              cursor: 'col-resize',
              transition: 'background 0.2s',
              _hover: {
                bg: isDark ? 'brand.600' : 'brand.400',
              },
              _active: {
                bg: 'brand.500',
              },
              _before: {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '3px',
                height: '20px',
                bg: isDark ? 'gray.500' : 'gray.400',
                borderRadius: 'full',
                boxShadow: isDark
                  ? '0 -8px 0 0 rgb(107, 114, 128), 0 8px 0 0 rgb(107, 114, 128)'
                  : '0 -8px 0 0 rgb(156, 163, 175), 0 8px 0 0 rgb(156, 163, 175)',
              },
            })}
          />

          {/* Center Panel: Preview */}
          <Panel defaultSize={56} minSize={40}>
            <div
              className={css({
                h: 'full',
                bg: isDark ? 'gray.800' : 'white',
                rounded: 'xl',
                shadow: 'card',
                p: '6',
                display: 'flex',
                flexDirection: 'column',
                gap: '4',
              })}
            >
              <div className={stack({ gap: '2' })}>
                <h2
                  className={css({
                    fontSize: 'xl',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.100' : 'gray.900',
                  })}
                >
                  Worksheet Preview
                </h2>
                <p
                  className={css({
                    fontSize: 'sm',
                    color: isDark ? 'gray.300' : 'gray.600',
                  })}
                >
                  This is where the large, interactive worksheet preview will appear
                </p>
              </div>

              {/* Mock Preview Area */}
              <div
                className={css({
                  flex: 1,
                  bg: isDark ? 'gray.700' : 'gray.50',
                  rounded: 'lg',
                  border: '2px dashed',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minH: '500px',
                })}
              >
                <div className={stack({ gap: '3', textAlign: 'center' })}>
                  <div
                    className={css({
                      fontSize: '4xl',
                    })}
                  >
                    📄
                  </div>
                  <div
                    className={css({
                      fontSize: 'lg',
                      fontWeight: 'medium',
                      color: isDark ? 'gray.300' : 'gray.600',
                    })}
                  >
                    Worksheet Preview SVG
                  </div>
                  <div
                    className={css({
                      fontSize: 'sm',
                      color: isDark ? 'gray.400' : 'gray.500',
                    })}
                  >
                    60-65% of screen width
                    <br />
                    Resizable by dragging handles
                  </div>
                </div>
              </div>

              {/* Pagination */}
              <div className={hstack({ gap: '3', justify: 'center' })}>
                <button
                  className={css({
                    px: '4',
                    py: '2',
                    bg: 'brand.600',
                    color: 'white',
                    rounded: 'lg',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    cursor: 'pointer',
                    _hover: { bg: 'brand.700' },
                  })}
                >
                  ← Previous
                </button>
                <span
                  className={css({
                    fontSize: 'sm',
                    color: isDark ? 'gray.300' : 'gray.700',
                  })}
                >
                  Page 1 of 2
                </span>
                <button
                  className={css({
                    px: '4',
                    py: '2',
                    bg: 'brand.600',
                    color: 'white',
                    rounded: 'lg',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    cursor: 'pointer',
                    _hover: { bg: 'brand.700' },
                  })}
                >
                  Next →
                </button>
              </div>

              {/* Info */}
              <div
                className={css({
                  bg: isDark ? 'rgba(59, 130, 246, 0.1)' : 'blue.50',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'blue.200',
                  rounded: 'lg',
                  p: '3',
                  fontSize: 'sm',
                  color: isDark ? 'blue.300' : 'blue.800',
                })}
              >
                <strong>Full worksheet:</strong> 20 problems in a 4×5 grid
              </div>
            </div>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle
            className={css({
              width: '8px',
              bg: isDark ? 'gray.700' : 'gray.200',
              position: 'relative',
              cursor: 'col-resize',
              transition: 'background 0.2s',
              _hover: {
                bg: isDark ? 'brand.600' : 'brand.400',
              },
              _active: {
                bg: 'brand.500',
              },
              _before: {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '3px',
                height: '20px',
                bg: isDark ? 'gray.500' : 'gray.400',
                borderRadius: 'full',
                boxShadow: isDark
                  ? '0 -8px 0 0 rgb(107, 114, 128), 0 8px 0 0 rgb(107, 114, 128)'
                  : '0 -8px 0 0 rgb(156, 163, 175), 0 8px 0 0 rgb(156, 163, 175)',
              },
            })}
          />

          {/* Right Panel: Actions */}
          <Panel defaultSize={22} minSize={15} maxSize={30} collapsible>
            <div
              className={css({
                h: 'full',
                bg: isDark ? 'gray.800' : 'white',
                rounded: 'xl',
                shadow: 'card',
                p: '4',
                overflow: 'auto',
              })}
            >
              <div className={stack({ gap: '4' })}>
                <h2
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.100' : 'gray.900',
                  })}
                >
                  Actions & Layout
                </h2>

                {/* Quick Layout Info */}
                <div
                  className={css({
                    bg: isDark ? 'gray.750' : 'gray.50',
                    rounded: 'lg',
                    p: '3',
                  })}
                >
                  <div className={stack({ gap: '2' })}>
                    <div
                      className={css({
                        fontSize: 'xs',
                        fontWeight: 'semibold',
                        color: isDark ? 'gray.400' : 'gray.500',
                        textTransform: 'uppercase',
                        letterSpacing: 'wider',
                      })}
                    >
                      Quick Layout
                    </div>
                    <div
                      className={css({
                        fontSize: 'sm',
                        color: isDark ? 'gray.300' : 'gray.700',
                      })}
                    >
                      📄 Portrait
                      <br />
                      15 problems
                      <br />2 pages
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <button
                  className={css({
                    w: 'full',
                    py: '3',
                    px: '4',
                    bg: 'brand.600',
                    color: 'white',
                    rounded: 'xl',
                    fontSize: 'md',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    _hover: {
                      bg: 'brand.700',
                      transform: 'translateY(-1px)',
                      shadow: 'lg',
                    },
                  })}
                >
                  📥 Generate PDF
                </button>

                <button
                  className={css({
                    w: 'full',
                    py: '3',
                    px: '4',
                    bg: isDark ? 'purple.600' : 'purple.500',
                    color: 'white',
                    rounded: 'xl',
                    fontSize: 'md',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    _hover: {
                      bg: isDark ? 'purple.700' : 'purple.600',
                      transform: 'translateY(-1px)',
                      shadow: 'lg',
                    },
                  })}
                >
                  📤 Upload Worksheet
                </button>

                {/* Layout Controls Preview */}
                <div
                  className={css({
                    borderTop: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                    pt: '4',
                    mt: '2',
                  })}
                >
                  <div className={stack({ gap: '3' })}>
                    <div
                      className={css({
                        fontSize: 'xs',
                        fontWeight: 'semibold',
                        color: isDark ? 'gray.400' : 'gray.500',
                        textTransform: 'uppercase',
                        letterSpacing: 'wider',
                      })}
                    >
                      More Layout Options
                    </div>
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: isDark ? 'gray.400' : 'gray.600',
                        lineHeight: '1.6',
                      })}
                    >
                      Orientation, problems per page, and other layout controls appear here (moved
                      from Layout tab for quick access)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </PageWithNav>
  )
}
