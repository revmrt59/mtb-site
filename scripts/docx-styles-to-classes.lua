-- docx-styles-to-classes.lua
-- Robustly map docx "custom-style" to HTML classes (no crashes).

local function slug(s)
  s = s:lower()
  s = s:gsub("[^%w]+", "-")
  s = s:gsub("%-+", "-")
  s = s:gsub("^%-", ""):gsub("%-$", "")
  return s
end

local function apply(el)
  -- Works across pandoc versions:
  -- Some elements expose attr (with classes + attributes), some expose classes/attributes directly.
  local attrs = nil
  local classes = nil

  if el.attr then
    attrs = el.attr.attributes
    classes = el.attr.classes
  else
    attrs = el.attributes
    classes = el.classes
  end

  if not attrs or not classes then
    return nil
  end

  local cs = attrs["custom-style"]
  if cs and cs ~= "" then
    table.insert(classes, slug(cs))
    attrs["custom-style"] = nil
    return el
  end

  return nil
end

function Span(el)   return apply(el) end
function Div(el)    return apply(el) end
function Header(el) return apply(el) end
