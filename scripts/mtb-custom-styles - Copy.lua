local map = {
  ["MTB Scripture"] = "mtb-scripture",
  ["MTB Scripture Block"] = "mtb-scripture",
  ["MTB Callout"] = "mtb-callout",
  ["MTB Note"] = "mtb-note",
  ["MTB Question"] = "mtb-question",
  ["MTB Term"] = "mtb-term"
}

local function processElement(el)
  local cs = el.attributes and el.attributes["custom-style"] or nil
  if cs and map[cs] then
    el.attributes["custom-style"] = nil
    if not el.classes then el.classes = {} end
    el.classes:insert(map[cs])
    return el
  end
end

-- Catch paragraph level styles (Headers/Blocks)
function Para(el) return processElement(el) end
function Div(el)  return processElement(el) end
function Span(el) return processElement(el) end
