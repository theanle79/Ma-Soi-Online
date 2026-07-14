const MODERATOR_SCRIPTS = {
  // --- PHE SÓI & BIẾN THỂ SÓI ---
  werewolf: "Ma Sói thức dậy. Hãy nhận biết đồng đội và cùng chỉ tay thống nhất 1 người để cắn đêm nay. Ma Sói đi ngủ.",
  lone_wolf: "Sói Đơn Độc thức dậy. Quan Trò xác nhận vai. Nếu bạn là con Sói duy nhất còn sống, bạn có thể cắn thêm mục tiêu thứ hai. Sói Đơn Độc đi ngủ.",
  fruit_wolf: "Sói Ăn Chay thức dậy cùng phe Sói để nhận biết đồng đội. Tối nay Sói Ăn Chay chọn 1 người để khóa năng lực thay vì cắn chết. Sói Ăn Chay đi ngủ.",
  wolf_cub: "Sói Con thức dậy cùng phe Sói để chọn mục tiêu. Nếu Sói Con chết, đêm tiếp theo Ma Sói sẽ được cắn 2 người. Sói Con đi ngủ.",
  alpha_wolf: "Sói Đầu Đàn thức dậy cùng phe Sói. Nếu muốn dùng quyền biến nạn nhân thành Sói thay vì cắn chết, hãy chỉ tay cho Quan Trò biết. Sói Đầu Đàn đi ngủ.",
  fang_face: "Sói Nanh Độc thức dậy cùng phe Sói để nhận biết đồng đội. Quan Trò xác nhận vai Sói Nanh Độc. Sói Nanh Độc đi ngủ.",
  minion: "Kẻ Hầu Sói thức dậy. Tất cả Ma Sói giơ tay lên để Kẻ Hầu Sói nhận biết. (Kẻ Hầu Sói không biết vai cụ thể, chỉ biết ai là Sói). Kẻ Hầu Sói đi ngủ.",
  sorceress: "Phù Thủy Sói thức dậy. Hãy chỉ 1 người, Quan Trò sẽ cho biết người đó có phải là Tiên Tri hay không. Phù Thủy Sói đi ngủ.",

  // --- PHE THỨ BA / PHE KHÁC ---
  vampire: "Ma Cà Rồng thức dậy. Hãy nhận biết đồng đội và thống nhất chỉ 1 mục tiêu để hút máu đêm nay. Ma Cà Rồng đi ngủ.",
  hoodlum: "Kẻ Du Côn thức dậy. Hãy chọn 2 người chơi mà bạn muốn họ phải chết để bạn giành chiến thắng. Kẻ Du Côn đi ngủ.",
  cult_leader: "Thủ Lĩnh Giáo Phái thức dậy. Hãy chỉ 1 người để lôi kéo vào giáo phái của bạn đêm nay. Thủ Lĩnh Giáo Phái đi ngủ.",
  tanner: "Kẻ Chán Đời không thức dậy ban đêm. Nhiệm vụ của bạn là dùng mọi cách để bị dân làng treo cổ vào ban ngày.",

  // --- PHE DÂN LÀNG: CHỨC NĂNG HÀNH ĐỘNG ---
  cupid: "Thần Tình Yêu thức dậy. Hãy chỉ 2 người để ghép họ thành cặp đôi tình nhân. Thần Tình Yêu đi ngủ.",
  guard: "Bảo Vệ thức dậy. Hãy chỉ 1 người bạn muốn bảo vệ đêm nay (không bảo vệ 1 người 2 đêm liên tiếp). Bảo Vệ đi ngủ.",
  priest: "Linh Mục thức dậy. Hãy chọn 1 người để tưới nước thánh. Nếu là Sói hoặc Ma Cà Rồng họ sẽ chết, nếu là Dân họ sẽ an toàn. Linh Mục đi ngủ.",
  witch: "Phù Thủy thức dậy. Đêm nay {victims} đã bị cắn. Bạn có muốn dùng bình Cứu không? Bạn có muốn dùng bình Độc giết 1 người khác không? Phù Thủy đi ngủ.",
  seer: "Tiên Tri thức dậy. Hãy chỉ 1 người bạn muốn soi. (Gật đầu = Phe Sói, Lắc đầu = Không phải Sói). Tiên Tri đi ngủ.",
  aura_seer: "Tiên Tri Hào Quang thức dậy. Hãy chỉ 1 người. Quan Trò sẽ cho biết người đó là Dân thường hay có chức năng/phe Sói. Tiên Tri Hào Quang đi ngủ.",
  mystic_seeker: "Nhà Thấu Thị thức dậy. Hãy chỉ 1 người để biết chính xác tên vai trò của người đó. Nhà Thấu Thị đi ngủ.",
  apprentice_seer: "Học Việc Tiên Tri thức dậy. Quan Trò xác nhận vai. Bạn sẽ trở thành Tiên Tri mới nếu Tiên Tri gốc bị loại. Học Việc Tiên Tri đi ngủ.",
  investigator: "Điều Tra Viên thức dậy. Hãy chọn 1 người, Quan Trò sẽ cho biết người đó thuộc nhóm chức năng nào. Điều Tra Viên đi ngủ.",
  spellcaster: "Pháp Sư thức dậy. Hãy chọn 1 người. Người đó sẽ bị câm và không được nói chuyện trong suốt ngày hôm sau. Pháp Sư đi ngủ.",
  old_hag: "Bà Phù Thủy Già thức dậy. Hãy chọn 1 người. Người đó sẽ bị đuổi khỏi làng và không được thảo luận hay biểu quyết ngày mai. Bà Phù Thủy Già đi ngủ.",
  mentalist: "Nhà Ngoại Cảm thức dậy. Hãy chỉ 2 người chơi. Quan Trò sẽ ra hiệu họ thuộc cùng phe hay khác phe. Nhà Ngoại Cảm đi ngủ.",
  gambler: "Kẻ Đánh Cược thức dậy. Hãy đoán 1 người thuộc phe Dân hay Sói/Thứ ba đêm nay. Đoán sai bạn sẽ chết. Kẻ Đánh Cược đi ngủ.",
  huntress: "Nữ Thợ Săn thức dậy. Bạn có muốn bắn 1 người ngay đêm nay không? Nếu có hãy chỉ mục tiêu. Nữ Thợ Săn đi ngủ.",

  // --- PHE DÂN LÀNG: XÁC NHẬN ĐÊM ĐẦU / THỤ ĐỘNG ---
  halfblood: "Bán Sói thức dậy. Quan Trò xác nhận vai. Bạn thuộc phe Dân cho đến khi bị Sói cắn sẽ hóa thành Sói. Bán Sói đi ngủ.",
  mayor: "Thị Trưởng thức dậy. Quan Trò xác nhận vai. Lá phiếu biểu quyết của bạn tính là 2 phiếu khi khai mở danh tính. Thị Trưởng đi ngủ.",
  tough_guy: "Người Cứng Cỏi thức dậy. Quan Trò xác nhận vai. Nếu bị Sói cắn, bạn sẽ sống thêm được 1 ngày và chết vào đêm tiếp theo. Người Cứng Cỏi đi ngủ.",
  rusty_knight: "Kỵ Sĩ Rỉ Sét thức dậy. Quan Trò xác nhận vai. Nếu bị Sói cắn chết, con Sói nằm bên trái bạn sẽ bị nhiễm trùng chết ở đêm sau. Kỵ Sĩ Rỉ Sét đi ngủ.",
  diseased: "Người Bệnh thức dậy. Quan Trò xác nhận vai. Nếu bị Sói cắn chết, phe Sói sẽ bị bệnh và không thể cắn ai vào đêm tiếp theo. Người Bệnh đi ngủ.",
  cursed: "Kẻ Bị Nguyền thức dậy. Quan Trò xác nhận vai. Ban đầu thuộc phe Dân, nhưng nếu bị Ma Sói cắn sẽ biến thành Sói thay vì chết. Kẻ Bị Nguyền đi ngủ.",
  hunter: "Thợ Săn không thức dậy ban đêm. Khi bị loại, Thợ Săn có quyền chọn 1 người khác cùng chết theo ngay lập tức.",
  prince: "Hoàng Tử không thức dậy ban đêm. Nếu bị biểu quyết treo cổ ban ngày, Hoàng Tử lật bài công khai và được tha bổng.",
  villager: "Dân Làng ngủ suốt đêm. Ban ngày thảo luận và biểu quyết tìm ra Ma Sói.",
};

const BASE_ROLE_CATALOG = [
  { id: "lone_wolf", name: "Sói Đơn Độc", team: "werewolf", value: -4, phase: "Đêm đầu", nightOrder: 3, wakesAtNight: "night_one", ability: "Thuộc phe Sói. Nếu là Ma Sói cuối cùng còn sống, có thể cắn thêm 1 nạn nhân mỗi đêm.", max: 1 },
  { id: "halfblood", name: "Bán Sói", team: "village", value: -1, phase: "Đêm đầu", nightOrder: 1, wakesAtNight: "night_one", ability: "Ban đầu thuộc phe Dân Làng. Nếu bị Ma Sói cắn, không chết mà sẽ biến thành Ma Sói.", max: 1 },
  { id: "mayor", name: "Thị Trưởng", team: "village", value: 2, phase: "Đêm đầu", nightOrder: 1, wakesAtNight: "night_one", ability: "Khi công khai danh tính Thị Trưởng, phiếu biểu quyết treo cổ của bạn tính là 2 phiếu.", max: 1 },
  { id: "tough_guy", name: "Người Cứng Cỏi", team: "village", value: 3, phase: "Đêm đầu", nightOrder: 1, wakesAtNight: "night_one", ability: "Nếu bị Ma Sói cắn đêm nay, bạn vẫn sống tiếp ngày hôm sau và chỉ chết vào đêm tiếp theo.", max: 1 },
  { id: "rusty_knight", name: "Kỵ Sĩ Rỉ Sét", team: "village", value: 5, phase: "Đêm đầu", nightOrder: 1, wakesAtNight: "night_one", ability: "Nếu bị Ma Sói cắn chết, con Ma Sói ngồi gần nhất bên tay trái bạn sẽ bị nhiễm trùng và chết ở đêm sau.", max: 1 },
  { id: "diseased", name: "Người Bệnh", team: "village", value: 3, phase: "Đêm đầu", nightOrder: 1, wakesAtNight: "night_one", ability: "Nếu bị Ma Sói cắn chết, phe Sói sẽ bị nhiễm bệnh và mất lượt cắn vào đêm tiếp theo.", max: 1 },
  { id: "hoodlum", name: "Kẻ Du Côn", team: "other", value: 0, phase: "Đêm đầu", nightOrder: 1, wakesAtNight: "night_one", ability: "Chọn 2 người vào đêm đầu. Thắng cuộc nếu cả 2 mục tiêu đó đều bị loại trước khi trò chơi kết thúc.", max: 1 },
  { id: "cupid", name: "Thần Tình Yêu", team: "village", value: 3, phase: "Đêm đầu", nightOrder: 1, wakesAtNight: "night_one", recommended: true, ability: "Đêm đầu chọn 2 người làm cặp đôi. Nếu 1 trong 2 người chết, người còn lại sẽ chết theo.", max: 1 },
  { id: "guard", name: "Bảo Vệ", team: "village", value: 4, phase: "Mỗi đêm", nightOrder: 2, wakesAtNight: "every_night", recommended: true, ability: "Mỗi đêm chọn 1 người để bảo vệ khỏi bị Sói cắn (không bảo vệ 1 người 2 đêm liên tiếp).", max: 1 },
  { id: "priest", name: "Linh Mục", team: "village", value: 3, phase: "Mỗi đêm", nightOrder: 2, wakesAtNight: "every_night", ability: "Dùng nước thánh lên 1 người. Nếu là Sói/Ma Cà Rồng họ sẽ chết, nếu là Dân Làng họ sẽ an toàn.", max: 1 },
  { id: "werewolf", name: "Ma Sói", team: "werewolf", value: -6, phase: "Mỗi đêm", nightOrder: 3, wakesAtNight: "every_night", recommended: true, ability: "Cùng đồng đội thức dậy mỗi đêm và thống nhất chọn 1 người chơi để cắn chết.", max: 10 },
  { id: "fruit_wolf", name: "Sói Ăn Chay", team: "werewolf", value: -3, phase: "Đêm đầu", nightOrder: 3, wakesAtNight: "night_one", ability: "Thức dậy cùng phe Sói. Có thể chọn khóa năng lực 1 người chơi đêm đó thay vì cắn chết.", max: 1 },
  { id: "wolf_cub", name: "Sói Con", team: "werewolf", value: -8, phase: "Đêm đầu", nightOrder: 3, wakesAtNight: "night_one", ability: "Thức dậy cùng phe Sói. Nếu Sói Con bị loại, phe Sói được quyền cắn 2 người vào đêm tiếp theo.", max: 1 },
  { id: "minion", name: "Kẻ Hầu Sói", team: "werewolf", value: -6, phase: "Đêm đầu", nightOrder: 3, wakesAtNight: "night_one", ability: "Biết ai là Ma Sói nhưng Sói không biết bạn. Tìm cách ngụy trang để hỗ trợ phe Sói thắng.", max: 1 },
  { id: "alpha_wolf", name: "Sói Đầu Đàn", team: "werewolf", value: -9, phase: "Mỗi đêm", nightOrder: 3, wakesAtNight: "every_night", ability: "Mỗi ván có 1 lần quyền năng: Biến nạn nhân bị cắn đêm đó thành Ma Sói thay vì giết chết.", max: 1 },
  { id: "fang_face", name: "Sói Nanh Độc", team: "werewolf", value: -5, phase: "Đêm đầu", nightOrder: 3, wakesAtNight: "night_one", ability: "Thức dậy cùng phe Sói. Khi bị soi bởi Tiên Tri, kết quả hiển thị vẫn là Dân Làng.", max: 1 },
  { id: "vampire", name: "Ma Cà Rồng", team: "vampire", value: -7, phase: "Mỗi đêm", nightOrder: 3, wakesAtNight: "every_night", ability: "Thức dậy mỗi đêm cùng đồng đội Ma Cà Rồng để chọn 1 mục tiêu hút máu tiêu diệt.", max: 6 },
  { id: "witch", name: "Phù Thủy", team: "village", value: 5, phase: "Mỗi đêm", nightOrder: 4, wakesAtNight: "every_night", recommended: true, ability: "Sở hữu 1 bình Cứu (cứu nạn nhân bị Sói cắn) và 1 bình Độc (đầu độc chết 1 người). Mỗi bình dùng 1 lần.", max: 1 },
  { id: "seer", name: "Tiên Tri", team: "village", value: 7, phase: "Mỗi đêm", nightOrder: 4, wakesAtNight: "every_night", recommended: true, ability: "Mỗi đêm chọn 1 người để soi và nhận biết người đó có thuộc phe Sói hay không.", max: 1 },
  { id: "aura_seer", name: "Tiên Tri Hào Quang", team: "village", value: 3, phase: "Mỗi đêm", nightOrder: 4, wakesAtNight: "every_night", ability: "Soi 1 người để biết người đó là Dân Thường hay có Chức năng đặc biệt / Thuộc phe Sói.", max: 1 },
  { id: "mystic_seeker", name: "Nhà Thấu Thị", team: "village", value: 9, phase: "Mỗi đêm", nightOrder: 4, wakesAtNight: "every_night", ability: "Mỗi đêm soi 1 người để biết chính xác tên vai trò (chức năng) cụ thể của người đó.", max: 1 },
  { id: "apprentice_seer", name: "Học Việc Tiên Tri", team: "village", value: 4, phase: "Mỗi đêm", nightOrder: 4, wakesAtNight: "every_night", ability: "Khi Tiên Tri chính bị loại, bạn sẽ kế thừa năng lực và trở thành Tiên Tri mới vào đêm sau.", max: 1 },
  { id: "sorceress", name: "Phù Thủy Sói", team: "werewolf", value: -3, phase: "Đêm đầu", nightOrder: 4, wakesAtNight: "night_one", ability: "Phe Sói. Mỗi đêm được chọn 1 người để kiểm tra xem người đó có phải là Tiên Tri hay không.", max: 1 },
  { id: "hunter", name: "Thợ Săn", team: "village", value: 3, phase: "Khi bị loại", nightOrder: 5, wakesAtNight: "never", recommended: true, ability: "Khi bị loại khỏi cuộc chơi (bị Sói cắn hoặc bị treo cổ), được kéo theo 1 người chết cùng.", max: 1 },
  { id: "huntress", name: "Nữ Thợ Săn", team: "village", value: 3, phase: "Mỗi đêm", nightOrder: 5, wakesAtNight: "every_night", ability: "Sở hữu 1 viên đạn. Có thể chọn bắn chết 1 người vào ban đêm (chỉ sử dụng năng lực 1 lần).", max: 1 },
  { id: "investigator", name: "Điều Tra Viên", team: "village", value: 4, phase: "Mỗi đêm", nightOrder: 5, wakesAtNight: "every_night", ability: "Mỗi đêm chọn 1 người để biết người đó thuộc nhóm vai trò nào trong bàn chơi.", max: 1 },
  { id: "spellcaster", name: "Pháp Sư", team: "village", value: 1, phase: "Mỗi đêm", nightOrder: 5, wakesAtNight: "every_night", ability: "Mỗi đêm chọn 1 người. Người đó sẽ bị câm (không được phát biểu hay ra hiệu) suốt ngày hôm sau.", max: 1 },
  { id: "cursed", name: "Kẻ Bị Nguyền", team: "village", value: -2, phase: "Đêm đầu", nightOrder: 5, wakesAtNight: "night_one", recommended: true, ability: "Ban đầu thuộc phe Dân Làng. Nếu bị Ma Sói cắn, biến thành Ma Sói và gia nhập phe Sói.", max: 1 },
  { id: "old_hag", name: "Bà Phù Thủy Già", team: "village", value: 1, phase: "Mỗi đêm", nightOrder: 5, wakesAtNight: "every_night", ability: "Mỗi đêm chỉ định 1 người. Người đó phải rời làng, không được tham gia thảo luận/biểu quyết ngày sau.", max: 1 },
  { id: "mentalist", name: "Nhà Ngoại Cảm", team: "village", value: 4, phase: "Mỗi đêm", nightOrder: 5, wakesAtNight: "every_night", ability: "Mỗi đêm chọn 2 người chơi để kiểm tra xem họ thuộc cùng phe hay khác phe nhau.", max: 1 },
  { id: "gambler", name: "Kẻ Đánh Cược", team: "village", value: 2, phase: "Từ đêm 2", nightOrder: 5, wakesAtNight: "from_night_two", ability: "Từ đêm 2, đoán 1 người thuộc phe Dân hay Sói/Thứ ba. Nếu đoán sai, bạn sẽ tự chết vào sáng hôm sau.", max: 1 },
  { id: "cult_leader", name: "Thủ Lĩnh Giáo Phái", team: "other", value: 1, phase: "Mỗi đêm", nightOrder: 5, wakesAtNight: "every_night", ability: "Mỗi đêm thu phục 1 người vào Giáo Phái. Thắng nếu tất cả người còn sống đều thuộc Giáo Phái.", max: 1 },
  { id: "prince", name: "Hoàng Tử", team: "village", value: 2, phase: "Không thức", nightOrder: 99, wakesAtNight: "never", ability: "Nếu bị biểu quyết treo cổ ban ngày, bạn lật bài công khai chức năng và sẽ không bị treo cổ.", max: 1 },
  { id: "tanner", name: "Kẻ Chán Đời", team: "other", value: -2, phase: "Không thức", nightOrder: 99, wakesAtNight: "never", ability: "Thuộc phe độc lập. Giành chiến thắng duy nhất và kết thúc game nếu bị dân làng biểu quyết treo cổ.", max: 1 },
  { id: "villager", name: "Dân Làng", team: "village", value: 1, phase: "Không thức", nightOrder: 99, wakesAtNight: "never", recommended: true, ability: "Không có năng lực ban đêm. Sử dụng lập luận và lắng nghe vào ban ngày để tìm ra Ma Sói.", max: 30 },
];

export const ROLE_CATALOG = BASE_ROLE_CATALOG.map((role) => ({
  ...role,
  moderatorScript: MODERATOR_SCRIPTS[role.id],
}));

export const ROLE_BY_ID = new Map(ROLE_CATALOG.map((role) => [role.id, role]));

export const BALANCE_MODES = {
  new_players: { id: "new_players", name: "Nhóm mới", target: 2, min: 1, max: 3, guidance: "Ưu tiên phe Dân để bàn chơi dễ làm quen." },
  balanced: { id: "balanced", name: "Cân bằng", target: 0, min: -3, max: 3, guidance: "Giữ tổng điểm gần bằng không." },
  experienced: { id: "experienced", name: "Nhóm quen", target: -2, min: -3, max: -1, guidance: "Cho phe Sói một lợi thế nhỏ." },
};