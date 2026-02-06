-- MTB Scripture Block wrapper (robust)
-- Works when DOCX+styles attaches custom-style to Para/Plain OR Div.
-- Wraps consecutive scripture-marked blocks into:
--   <div class="mtb-scripture-block"> ... </div>
-- Requires pandoc input: docx+styles

local SCRIPTURE_STYLES = {
  ["MTB Scripture"] = true,
  ["MTB Scripture Block"] = true
}

local function get_custom_style(el)
  if not el or not el.attr or not el.attr.attributes then return nil end
  return el.attr.attributes["custom-style"]
end

local function is_scripture_style_name(name)
  return name and SCRIPTURE_STYLES[name] or false
end

local function strip_custom_style(el)
  if el and el.attr and el.attr.attributes then
    el.attr.attributes["custom-style"] = nil
  end
  return el
end

-- Recursive inline scan (covers nested spans etc.)
local function inline_contains_scripture(inl)
  if not inl then return false end

  if inl.t == "Span" then
    if is_scripture_style_name(get_custom_style(inl)) then return true end
    if inl.content then
      for _, c in ipairs(inl.content) do
        if inline_contains_scripture(c) then return true end
      end
    end
    return false
  end

  if inl.content and type(inl.content) == "table" then
    for _, c in ipairs(inl.content) do
      if inline_contains_scripture(c) then return true end
    end
  end

  return false
end

-- Decide if a BLOCK should be treated as Scripture
local function block_is_scripture(b)
  if not b then return false end

  -- Case 1: the block itself carries custom-style=MTB Scripture (often Div in docx+styles)
  if is_scripture_style_name(get_custom_style(b)) then
    return true
  end

  -- Case 2: Para/Plain contains an inline marker somewhere
  if (b.t == "Para" or b.t == "Plain") and b.content then
    for _, inl in ipairs(b.content) do
      if inline_contains_scripture(inl) then return true end
    end
  end

  return false
end

function Pandoc(doc)
  local out = pandoc.List:new()
  local blocks = doc.blocks
  local i = 1

  while i <= #blocks do
    local b = blocks[i]

    if block_is_scripture(b) then
      local group = pandoc.List:new()

      while i <= #blocks and block_is_scripture(blocks[i]) do
        group:insert(strip_custom_style(blocks[i]))
        i = i + 1
      end

      out:insert(pandoc.Div(group, pandoc.Attr("", {"mtb-scripture-block"}, {})))
    else
      out:insert(strip_custom_style(b))
      i = i + 1
    end
  end

  doc.blocks = out
  return doc
end
