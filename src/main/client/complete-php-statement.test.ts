import { describe, expect, it } from 'vitest'
import { completePhpStatement, normalizeForEval } from './complete-php-statement'

describe('completePhpStatement', () => {
  it.each([
    ['echo 1', 'echo 1;'],
    ['echo 1;  \n', 'echo 1;  \n'],
    ['echo 1 // comment', 'echo 1; // comment'],
    ['echo 1; // comment', 'echo 1; // comment'],
    ['echo 1 /* comment */', 'echo 1; /* comment */'],
    ['echo "// not a comment"', 'echo "// not a comment";'],
    ["echo 'it\\'s fine'", "echo 'it\\'s fine';"],
    ['if (true) { echo 1; }', 'if (true) { echo 1; }'],
    ['while (0) {}', 'while (0) {}'],
    ['function f() {}', 'function f() {}'],
    ['namespace Foo {}', 'namespace Foo {}'],
    ['goto done; done:', 'goto done; done:'],
    ['if (true) echo 1', 'if (true) echo 1;'],
    ['foreach ([1] as $v) echo $v', 'foreach ([1] as $v) echo $v;'],
    ['namespace Foo; echo 1', 'namespace Foo; echo 1;'],
    ['if (true) $f = function () {}', 'if (true) $f = function () {};'],
    ['namespace Foo; $f = function () {}', 'namespace Foo; $f = function () {};'],
    ['if (true) $a = match (1) { 1 => 2 }', 'if (true) $a = match (1) { 1 => 2 };'],
    ['echo new DateTimeImmutable("2000-01-01")->format("Y")', 'echo new DateTimeImmutable("2000-01-01")->format("Y");'],
    [
      'class C { public string $x { get => "ok"; } } echo (new C)->x',
      'class C { public string $x { get => "ok"; } } echo (new C)->x;',
    ],
    ['$f = function () {}', '$f = function () {};'],
    ['do { echo 1; } while (0)', 'do { echo 1; } while (0);'],
    ['echo 1 ?>', 'echo 1 ?>'],
    ['echo 1 // comment ?>', 'echo 1 // comment ?>'],
    ['echo 1; ?>', 'echo 1; ?>'],
    ['<?php echo 1 ?>', '<?php echo 1 ?>'],
    ['<?php echo 1; ?><?= 2 ?>', '<?php echo 1; ?><?= 2 ?>'],
    ['<?= 1 ?>', '<?= 1 ?>'],
    ['<?= 1', '<?= 1;'],
    ['<?php echo 1', '<?php echo 1;'],
    ['\n<?php\necho 1', '\n<?php\necho 1;'],
    ['// comment only', '// comment only'],
    ['  ', '  '],
    ['echo "unfinished', 'echo "unfinished'],
    ['echo 1 /** unfinished', 'echo 1 /** unfinished'],
    ['echo 1 /* unfinished', 'echo 1 /* unfinished'],
    ['declare(ticks=1) echo 1', 'declare(ticks=1) echo 1;'],
    ['declare(ticks=2) echo 2', 'declare(ticks=2) echo 2;'],
    ['declare(ticks=1); echo 1', 'declare(ticks=1); echo 1;'],
    ['declare(ticks=1) { echo 1; }', 'declare(ticks=1) { echo 1; }'],
    ['declare(strict_types=1) echo "unfinished', 'declare(strict_types=1) echo "unfinished'],
    ['__halt_compiler(); payload', '__halt_compiler(); payload'],
    ['echo <<<TEXT\nhello\nTEXT', 'echo <<<TEXT\nhello\nTEXT;'],
    ['echo <<<TEXT\nhello\nTEXT;', 'echo <<<TEXT\nhello\nTEXT;'],
    ['$x = [<<<TXT\nhello\nTXT]; echo $x[0]', '$x = [<<<TXT\nhello\nTXT]; echo $x[0];'],
    ['echo <<<TXT\na\nTXT . "b"', 'echo <<<TXT\na\nTXT . "b";'],
    ['echo <<<世界\nhello\n世界', 'echo <<<世界\nhello\n世界;'],
    ['$a = ["//" => "ok"]; echo "{$a["//"]}";', '$a = ["//" => "ok"]; echo "{$a["//"]}";'],
    ['$a = ["?>" => "ok"]; echo "{$a["?>"]}";', '$a = ["?>" => "ok"]; echo "{$a["?>"]}";'],
    ['$a = ["#" => "ok"]; echo "{$a["#"]}";', '$a = ["#" => "ok"]; echo "{$a["#"]}";'],
    ['echo "{$a["x"]}"', 'echo "{$a["x"]}";'],
    ['echo "text with $var inside"', 'echo "text with $var inside";'],
    ["echo 'literal {$a'", "echo 'literal {$a';"],
    ['echo "unterminated {$a["', 'echo "unterminated {$a["'],
    ['$a = ["//" => "ok"]; echo "{$a[/* } */ "//"]}";', '$a = ["//" => "ok"]; echo "{$a[/* } */ "//"]}";'],
    ["$x = <<<'TXT'\nTXT世界 ?>\nTXT;\necho $x;", "$x = <<<'TXT'\nTXT世界 ?>\nTXT;\necho $x;"],
    ['$a = 1; // comment\recho $a', '$a = 1; // comment\recho $a;'],
    [
      '$a = [\'} " ?>\' => "ok"]; echo "{$a[<<<TXT\n} " ?>\nTXT\n]}"',
      '$a = [\'} " ?>\' => "ok"]; echo "{$a[<<<TXT\n} " ?>\nTXT\n]}";',
    ],
  ])('completes %j', (input, expected) => {
    const result = completePhpStatement(input)
    expect(result).toBe(expected)
    // The transformation is idempotent.
    expect(completePhpStatement(result)).toBe(result)
  })

  it.each([
    'echo 1;',
    'if (true) {}',
    'if (true) {} // trailing',
    'function f() {} /* trailing */',
    'namespace Foo {}\n',
    'echo 1 ?>',
    'goto done; done:',
    '__halt_compiler(); payload',
    '$a = 1;\n$a += 1;\necho $a;',
  ])('keeps valid code untouched: %j', code => {
    expect(completePhpStatement(code)).toBe(code)
  })

  it('preserves the number of lines', () => {
    const code = '$a = 1;\n$a += 1;\necho $a'
    expect(completePhpStatement(code).split('\n')).toHaveLength(code.split('\n').length)
  })

  describe('normalizeForEval', () => {
    it('strips the leading open tag only', () => {
      expect(normalizeForEval('<?php echo 1; ?>')).toBe(' echo 1; ?>')
      expect(normalizeForEval('<?PHP echo 1;')).toBe(' echo 1;')
    })

    it('keeps whitespace and newlines around the leading tag', () => {
      expect(normalizeForEval('\n<?php\necho 1;')).toBe('\n\necho 1;')
    })

    it('converts a leading short echo tag to echo, preserving offsets', () => {
      expect(normalizeForEval('<?= 1 ?>')).toBe('echo 1 ?>')
      expect(normalizeForEval('\n<?= 1 ?>')).toBe('\necho 1 ?>')
    })

    it('keeps tags inside strings', () => {
      expect(normalizeForEval('$s = "<?php "; echo $s;')).toBe('$s = "<?php "; echo $s;')
    })

    it('keeps code without tags unchanged', () => {
      expect(normalizeForEval('echo 1;')).toBe('echo 1;')
    })

    it('keeps reopenings and the HTML between them', () => {
      expect(normalizeForEval('echo 1; ?>text<?php echo 2;')).toBe('echo 1; ?>text<?php echo 2;')
    })
  })
})
